import { useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseCameraBroadcastOptions {
  attemptId: string;
  videoRef: React.RefObject<HTMLVideoElement>;
  isActive: boolean;
  frameInterval?: number;
}

export function useCameraBroadcast({
  attemptId,
  videoRef,
  isActive,
  frameInterval = 1000,
}: UseCameraBroadcastOptions) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const intervalRef = useRef<number | null>(null);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const isSubscribedRef = useRef(false);

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    // Ensure video has valid dimensions
    if (!video.videoWidth || !video.videoHeight) return null;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.6);
  }, [videoRef]);

  const sendFrame = useCallback(async () => {
    if (!isSubscribedRef.current || !channelRef.current) {
      console.log('Channel not ready for camera broadcast');
      return;
    }
    
    const frame = captureFrame();
    if (frame) {
      try {
        await channelRef.current.send({
          type: 'broadcast',
          event: 'camera-frame',
          payload: { frame },
        });
      } catch (error) {
        console.error('Failed to send camera frame:', error);
      }
    }
  }, [captureFrame]);

  const startBroadcast = useCallback(async () => {
    if (!attemptId || !isActive) return;

    // Create canvas for frame capture
    canvasRef.current = document.createElement('canvas');

    // Set up broadcast channel - use the same channel name as screen share
    channelRef.current = supabase.channel(`stream-${attemptId}`);
    
    // Subscribe to channel first, then start sending
    channelRef.current.subscribe((status) => {
      console.log('Camera broadcast channel status:', status);
      if (status === 'SUBSCRIBED') {
        isSubscribedRef.current = true;
        // Start sending frames after subscription is confirmed
        intervalRef.current = window.setInterval(sendFrame, frameInterval);
      }
    });
  }, [attemptId, isActive, frameInterval, sendFrame]);

  const stopBroadcast = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
    
    isSubscribedRef.current = false;
  }, []);

  useEffect(() => {
    if (isActive && attemptId) {
      startBroadcast();
    } else {
      stopBroadcast();
    }

    return () => {
      stopBroadcast();
    };
  }, [isActive, attemptId, startBroadcast, stopBroadcast]);

  return {
    startBroadcast,
    stopBroadcast,
  };
}
