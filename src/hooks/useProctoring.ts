import { useCallback, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface ProctoringConfig {
  attemptId: string;
  onFlag: (type: string, description: string) => void;
}

export function useProctoring({ attemptId, onFlag }: ProctoringConfig) {
  const lastFlagTime = useRef<Record<string, number>>({});
  const FLAG_COOLDOWN = 10000; // 10 seconds between same flag types

  const logFlag = useCallback(async (flagType: string, description: string) => {
    const now = Date.now();
    const lastTime = lastFlagTime.current[flagType] || 0;
    
    if (now - lastTime < FLAG_COOLDOWN) return;
    
    lastFlagTime.current[flagType] = now;
    onFlag(flagType, description);

    try {
      await supabase.from('proctoring_flags').insert({
        attempt_id: attemptId,
        flag_type: flagType,
        description,
      });
    } catch (error) {
      console.error('Failed to log proctoring flag:', error);
    }
  }, [attemptId, onFlag]);

  // Tab visibility detection
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        logFlag('tab_switch', 'Student switched to another tab or minimized the window');
      }
    };

    const handleBlur = () => {
      logFlag('window_blur', 'Browser window lost focus');
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [logFlag]);

  // Keyboard shortcuts detection (copy/paste prevention)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && ['c', 'v', 'x'].includes(e.key.toLowerCase())) {
        logFlag('copy_paste_attempt', `Attempted to use ${e.key.toUpperCase()} shortcut`);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [logFlag]);

  // Right-click prevention
  useEffect(() => {
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      logFlag('right_click', 'Attempted to open context menu');
    };

    window.addEventListener('contextmenu', handleContextMenu);
    return () => window.removeEventListener('contextmenu', handleContextMenu);
  }, [logFlag]);

  return { logFlag };
}