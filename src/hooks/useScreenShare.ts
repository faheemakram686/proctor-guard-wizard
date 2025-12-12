import { useState, useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseScreenShareOptions {
  attemptId: string;
  frameInterval?: number; // ms between frames
}

export function useScreenShare({ attemptId, frameInterval = 1000 }: UseScreenShareOptions) {
  const [isSharing, setIsSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isSubscribedRef = useRef(false);

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    // Ensure video has valid dimensions
    if (!video.videoWidth || !video.videoHeight) return null;
    
    canvas.width = Math.min(video.videoWidth, 1280);
    canvas.height = Math.min(video.videoHeight, 720);
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.5);
  }, []);

  const sendFrame = useCallback(async () => {
    if (!isSubscribedRef.current || !channelRef.current) {
      console.log('Channel not ready for screen share');
      return;
    }
    
    const frame = captureFrame();
    if (frame) {
      try {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'screen-frame',
          payload: { frame },
        });
      } catch (err) {
        console.error('Failed to send screen frame:', err);
      }
    }
  }, [captureFrame]);

  const startSharing = useCallback(async () => {
    try {
      setError(null);

      // Request screen share
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          width: { max: 1920 },
          height: { max: 1080 },
        },
        audio: false,
      } as DisplayMediaStreamOptions);

      streamRef.current = stream;

      // Create video element to capture frames
      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      videoRef.current = video;

      // Create canvas for frame capture
      const canvas = document.createElement('canvas');
      canvasRef.current = canvas;

      // Set up broadcast channel
      channelRef.current = supabase.channel(`stream-${attemptId}`);
      
      // Subscribe to channel first, then start sending
      channelRef.current.subscribe((status) => {
        console.log('Screen share channel status:', status);
        if (status === 'SUBSCRIBED') {
          isSubscribedRef.current = true;
          // Start sending frames after subscription is confirmed
          intervalRef.current = window.setInterval(sendFrame, frameInterval);
        }
      });

      // Handle stream end
      stream.getVideoTracks()[0].onended = () => {
        stopSharing();
      };

      setIsSharing(true);
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Screen share failed';
      setError(message);
      setIsSharing(false);
      return false;
    }
  }, [attemptId, frameInterval, sendFrame]);

  const stopSharing = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    isSubscribedRef.current = false;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current = null;
    }

    setIsSharing(false);
  }, []);

  useEffect(() => {
    return () => {
      stopSharing();
    };
  }, [stopSharing]);

  return {
    isSharing,
    error,
    startSharing,
    stopSharing,
  };
}
