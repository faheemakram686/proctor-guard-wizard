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

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.6);
  }, [videoRef]);

  const sendFrame = useCallback(async () => {
    const frame = captureFrame();
    if (frame && channelRef.current) {
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

    // Set up broadcast channel
    channelRef.current = supabase.channel(`stream-${attemptId}`);
    await channelRef.current.subscribe();

    // Start sending frames
    intervalRef.current = window.setInterval(sendFrame, frameInterval);
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
