import { useRef, useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseStreamBroadcastOptions {
  attemptId: string;
  frameInterval?: number;
}

interface StreamRefs {
  screenVideo: HTMLVideoElement | null;
  screenCanvas: HTMLCanvasElement | null;
  screenStream: MediaStream | null;
  cameraVideo: HTMLVideoElement | null;
  cameraCanvas: HTMLCanvasElement | null;
}

export function useStreamBroadcast({
  attemptId,
  frameInterval = 1000,
}: UseStreamBroadcastOptions) {
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isCameraBroadcasting, setIsCameraBroadcasting] = useState(false);
  const [screenError, setScreenError] = useState<string | null>(null);
  const [isChannelReady, setIsChannelReady] = useState(false);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const intervalRef = useRef<number | null>(null);
  const refsRef = useRef<StreamRefs>({
    screenVideo: null,
    screenCanvas: null,
    screenStream: null,
    cameraVideo: null,
    cameraCanvas: null,
  });
  const cameraVideoExternalRef = useRef<HTMLVideoElement | null>(null);

  // Initialize channel once
  useEffect(() => {
    if (!attemptId) return;

    channelRef.current = supabase.channel('proctoring-stream');
    
    channelRef.current.subscribe((status) => {
      console.log('Stream broadcast channel status:', status);
      if (status === 'SUBSCRIBED') {
        setIsChannelReady(true);
      } else {
        setIsChannelReady(false);
      }
    });

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      setIsChannelReady(false);
    };
  }, [attemptId]);

  // Capture and send frames
  const sendFrames = useCallback(async () => {
    if (!channelRef.current || !isChannelReady) return;

    const refs = refsRef.current;

    // Send screen frame
    if (refs.screenVideo && refs.screenCanvas && refs.screenVideo.videoWidth) {
      const canvas = refs.screenCanvas;
      canvas.width = Math.min(refs.screenVideo.videoWidth, 1280);
      canvas.height = Math.min(refs.screenVideo.videoHeight, 720);
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(refs.screenVideo, 0, 0, canvas.width, canvas.height);
        const frame = canvas.toDataURL('image/jpeg', 0.5);
        try {
          await channelRef.current.send({
            type: 'broadcast',
            event: 'screen-frame',
            payload: { attemptId, frame },
          });
        } catch (err) {
          console.error('Failed to send screen frame:', err);
        }
      }
    }

    // Send camera frame
    const cameraVideo = cameraVideoExternalRef.current;
    if (cameraVideo && refs.cameraCanvas && cameraVideo.videoWidth) {
      const canvas = refs.cameraCanvas;
      canvas.width = cameraVideo.videoWidth || 640;
      canvas.height = cameraVideo.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(cameraVideo, 0, 0, canvas.width, canvas.height);
        const frame = canvas.toDataURL('image/jpeg', 0.6);
        try {
          await channelRef.current.send({
            type: 'broadcast',
            event: 'camera-frame',
            payload: { attemptId, frame },
          });
        } catch (err) {
          console.error('Failed to send camera frame:', err);
        }
      }
    }
  }, [isChannelReady]);

  // Start/stop frame sending based on active streams
  useEffect(() => {
    if (isChannelReady && (isScreenSharing || isCameraBroadcasting)) {
      if (!intervalRef.current) {
        intervalRef.current = window.setInterval(sendFrames, frameInterval);
        console.log('Started frame broadcasting interval');
      }
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
        console.log('Stopped frame broadcasting interval');
      }
    }
  }, [isChannelReady, isScreenSharing, isCameraBroadcasting, frameInterval, sendFrames]);

  // Screen sharing functions
  const startScreenShare = useCallback(async () => {
    try {
      setScreenError(null);

      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: { max: 1920 }, height: { max: 1080 } },
        audio: false,
      } as DisplayMediaStreamOptions);

      const video = document.createElement('video');
      video.srcObject = stream;
      video.muted = true;
      await video.play();

      const canvas = document.createElement('canvas');

      refsRef.current.screenVideo = video;
      refsRef.current.screenCanvas = canvas;
      refsRef.current.screenStream = stream;

      stream.getVideoTracks()[0].onended = () => {
        stopScreenShare();
      };

      setIsScreenSharing(true);
      console.log('Screen sharing started');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Screen share failed';
      setScreenError(message);
      return false;
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    const refs = refsRef.current;
    if (refs.screenStream) {
      refs.screenStream.getTracks().forEach((track) => track.stop());
    }
    refs.screenVideo = null;
    refs.screenCanvas = null;
    refs.screenStream = null;
    setIsScreenSharing(false);
    console.log('Screen sharing stopped');
  }, []);

  // Camera broadcasting functions
  const startCameraBroadcast = useCallback((videoElement: HTMLVideoElement) => {
    cameraVideoExternalRef.current = videoElement;
    refsRef.current.cameraCanvas = document.createElement('canvas');
    setIsCameraBroadcasting(true);
    console.log('Camera broadcasting started');
  }, []);

  const stopCameraBroadcast = useCallback(() => {
    cameraVideoExternalRef.current = null;
    refsRef.current.cameraCanvas = null;
    setIsCameraBroadcasting(false);
    console.log('Camera broadcasting stopped');
  }, []);

  return {
    // Screen share
    isScreenSharing,
    screenError,
    startScreenShare,
    stopScreenShare,
    // Camera broadcast
    isCameraBroadcasting,
    startCameraBroadcast,
    stopCameraBroadcast,
    // Channel status
    isChannelReady,
  };
}
