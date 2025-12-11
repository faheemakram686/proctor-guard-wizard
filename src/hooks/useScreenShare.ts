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

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    
    canvas.width = Math.min(video.videoWidth, 1280);
    canvas.height = Math.min(video.videoHeight, 720);
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.5);
  }, []);

  const sendFrame = useCallback(async () => {
    const frame = captureFrame();
    if (frame && channelRef.current) {
      await channelRef.current.send({
        type: 'broadcast',
        event: 'screen-frame',
        payload: { frame },
      });
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
      await channelRef.current.subscribe();

      // Handle stream end
      stream.getVideoTracks()[0].onended = () => {
        stopSharing();
      };

      // Start sending frames
      intervalRef.current = window.setInterval(sendFrame, frameInterval);

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
