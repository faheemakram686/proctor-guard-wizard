import { useState, useEffect, useCallback, useRef } from 'react';

export function useExamTimer(durationMinutes: number, onTimeUp: () => void) {
  const [remainingSeconds, setRemainingSeconds] = useState(durationMinutes * 60);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onTimeUpRef = useRef(onTimeUp);

  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  }, [onTimeUp]);

  const start = useCallback(() => {
    setIsRunning(true);
  }, []);

  const pause = useCallback(() => {
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    setRemainingSeconds(durationMinutes * 60);
    setIsRunning(false);
  }, [durationMinutes]);

  useEffect(() => {
    if (isRunning && remainingSeconds > 0) {
      intervalRef.current = setInterval(() => {
        setRemainingSeconds(prev => {
          if (prev <= 1) {
            setIsRunning(false);
            onTimeUpRef.current();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, remainingSeconds]);

  const formatTime = useCallback((seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }, []);

  const isLowTime = remainingSeconds <= 300; // 5 minutes
  const isCriticalTime = remainingSeconds <= 60; // 1 minute

  return {
    remainingSeconds,
    formattedTime: formatTime(remainingSeconds),
    isRunning,
    isLowTime,
    isCriticalTime,
    start,
    pause,
    reset,
  };
}