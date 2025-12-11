import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface UseAdminNotificationsOptions {
  attemptId: string;
  onTerminate?: () => void;
  onComplete?: () => void;
}

export function useAdminNotifications({
  attemptId,
  onTerminate,
  onComplete,
}: UseAdminNotificationsOptions) {
  const { toast } = useToast();

  const handleWarning = useCallback((message: string) => {
    toast({
      title: '⚠️ Warning from Administrator',
      description: message,
      variant: 'destructive',
      duration: 10000,
    });
  }, [toast]);

  const handleTerminate = useCallback(() => {
    toast({
      title: 'Exam Terminated',
      description: 'Your exam has been terminated by the administrator.',
      variant: 'destructive',
      duration: 10000,
    });
    onTerminate?.();
  }, [toast, onTerminate]);

  const handleComplete = useCallback((message: string) => {
    toast({
      title: 'Exam Completed',
      description: message || 'Your exam has been marked as complete.',
      duration: 10000,
    });
    onComplete?.();
  }, [toast, onComplete]);

  useEffect(() => {
    if (!attemptId) return;

    const channel = supabase
      .channel(`student-${attemptId}`)
      .on('broadcast', { event: 'admin-warning' }, (payload) => {
        handleWarning(payload.payload.message);
      })
      .on('broadcast', { event: 'exam-terminated' }, () => {
        handleTerminate();
      })
      .on('broadcast', { event: 'exam-completed' }, (payload) => {
        handleComplete(payload.payload.message);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [attemptId, handleWarning, handleTerminate, handleComplete]);
}
