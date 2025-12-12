import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ArrowLeft, Monitor, Camera, AlertTriangle, CheckCircle,
  XCircle, MessageSquare, Loader2, Volume2, VolumeX
} from 'lucide-react';

interface LiveProctoringViewProps {
  session: {
    id: string;
    attempt_id: string;
    student_id: string;
    student: {
      full_name: string;
      national_id: string;
    };
    exam_attempt: {
      exam: {
        title: string;
      };
    };
  };
  onBack: () => void;
}

interface ProctoringFlag {
  id: string;
  flag_type: string;
  description: string;
  created_at: string;
}

export function LiveProctoringView({ session, onBack }: LiveProctoringViewProps) {
  const [flags, setFlags] = useState<ProctoringFlag[]>([]);
  const [loading, setLoading] = useState(false);
  const [warningMessage, setWarningMessage] = useState('');
  const [showWarningDialog, setShowWarningDialog] = useState(false);
  const [showTerminateDialog, setShowTerminateDialog] = useState(false);
  const [showCompleteDialog, setShowCompleteDialog] = useState(false);
  const [screenStream, setScreenStream] = useState<string | null>(null);
  const [cameraStream, setCameraStream] = useState<string | null>(null);
  const [audioEnabled, setAudioEnabled] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadFlags();

    // Subscribe to realtime flags
    const flagChannel = supabase
      .channel(`flags-${session.attempt_id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'proctoring_flags',
          filter: `attempt_id=eq.${session.attempt_id}`,
        },
        (payload) => {
          setFlags((prev) => [payload.new as ProctoringFlag, ...prev]);
        }
      )
      .subscribe();

    // Subscribe to stream updates via Supabase Realtime broadcast
    const streamChannel = supabase
      .channel(`stream-${session.attempt_id}`)
      .on('broadcast', { event: 'screen-frame' }, (payload) => {
        console.log('Received screen frame');
        setScreenStream(payload.payload.frame);
      })
      .on('broadcast', { event: 'camera-frame' }, (payload) => {
        console.log('Received camera frame');
        setCameraStream(payload.payload.frame);
      })
      .subscribe((status) => {
        console.log('Admin stream channel status:', status);
      });

    return () => {
      supabase.removeChannel(flagChannel);
      supabase.removeChannel(streamChannel);
    };
  }, [session.attempt_id]);

  const loadFlags = async () => {
    const { data, error } = await supabase
      .from('proctoring_flags')
      .select('*')
      .eq('attempt_id', session.attempt_id)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setFlags(data);
    }
  };

  const sendWarning = async () => {
    if (!warningMessage.trim()) return;
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase.from('admin_actions').insert({
        attempt_id: session.attempt_id,
        admin_id: user.id,
        action_type: 'warning',
        message: warningMessage,
      });

      if (error) throw error;

      // Broadcast warning to student
      await supabase.channel(`student-${session.attempt_id}`).send({
        type: 'broadcast',
        event: 'admin-warning',
        payload: { message: warningMessage },
      });

      toast({
        title: 'Warning sent',
        description: 'The student has been notified.',
      });
      setWarningMessage('');
      setShowWarningDialog(false);
    } catch (error) {
      toast({
        title: 'Failed to send warning',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const terminateExam = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Log the action
      await supabase.from('admin_actions').insert({
        attempt_id: session.attempt_id,
        admin_id: user.id,
        action_type: 'terminate',
        message: 'Exam terminated by administrator',
      });

      // Update exam attempt
      await supabase
        .from('exam_attempts')
        .update({
          completed_at: new Date().toISOString(),
          passed: false,
          score: 0,
        })
        .eq('id', session.attempt_id);

      // End proctoring session
      await supabase
        .from('proctoring_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString(),
        })
        .eq('attempt_id', session.attempt_id);

      // Notify student
      await supabase.channel(`student-${session.attempt_id}`).send({
        type: 'broadcast',
        event: 'exam-terminated',
        payload: { reason: 'Exam terminated by administrator' },
      });

      toast({
        title: 'Exam terminated',
        description: 'The exam has been ended and the student has been notified.',
      });
      setShowTerminateDialog(false);
      onBack();
    } catch (error) {
      toast({
        title: 'Failed to terminate exam',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const markComplete = async () => {
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Log the action
      await supabase.from('admin_actions').insert({
        attempt_id: session.attempt_id,
        admin_id: user.id,
        action_type: 'complete',
        message: 'Exam marked as complete by administrator',
      });

      // Update exam attempt - mark as complete but don't change score
      await supabase
        .from('exam_attempts')
        .update({
          completed_at: new Date().toISOString(),
        })
        .eq('id', session.attempt_id);

      // End proctoring session
      await supabase
        .from('proctoring_sessions')
        .update({
          is_active: false,
          ended_at: new Date().toISOString(),
        })
        .eq('attempt_id', session.attempt_id);

      // Notify student
      await supabase.channel(`student-${session.attempt_id}`).send({
        type: 'broadcast',
        event: 'exam-completed',
        payload: { message: 'Your exam has been marked as complete by the administrator.' },
      });

      toast({
        title: 'Exam marked complete',
        description: 'The exam has been completed and the student has been notified.',
      });
      setShowCompleteDialog(false);
      onBack();
    } catch (error) {
      toast({
        title: 'Failed to complete exam',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getFlagIcon = (type: string) => {
    switch (type) {
      case 'tab_switch':
      case 'window_blur':
        return <Monitor className="w-4 h-4" />;
      case 'face_not_detected':
      case 'multiple_faces':
        return <Camera className="w-4 h-4" />;
      default:
        return <AlertTriangle className="w-4 h-4" />;
    }
  };

  const getFlagColor = (type: string) => {
    switch (type) {
      case 'tab_switch':
      case 'window_blur':
        return 'bg-warning/10 text-warning border-warning/30';
      case 'face_not_detected':
      case 'multiple_faces':
        return 'bg-destructive/10 text-destructive border-destructive/30';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={onBack}>
                <ArrowLeft className="w-5 h-5" />
              </Button>
              <div>
                <h1 className="font-bold text-lg">{session.student?.full_name}</h1>
                <p className="text-sm text-muted-foreground">
                  {session.exam_attempt?.exam?.title} • ID: {session.student?.national_id}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-success text-success-foreground animate-pulse">
                Live
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Video Feeds */}
          <div className="lg:col-span-2 space-y-4">
            {/* Screen Share */}
            <Card className="glass-card overflow-hidden">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Monitor className="w-4 h-4" />
                  Screen Share
                </CardTitle>
              </CardHeader>
              <CardContent className="p-2">
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center relative">
                  {screenStream ? (
                    <img 
                      src={screenStream} 
                      alt="Screen share" 
                      className="w-full h-full object-contain rounded-lg"
                    />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <Monitor className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Waiting for screen share...</p>
                      <p className="text-xs">Student needs to share their screen</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Camera Feed */}
            <Card className="glass-card overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Camera className="w-4 h-4" />
                    Camera Feed
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setAudioEnabled(!audioEnabled)}
                  >
                    {audioEnabled ? (
                      <Volume2 className="w-4 h-4" />
                    ) : (
                      <VolumeX className="w-4 h-4" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-2">
                <div className="aspect-video bg-muted rounded-lg flex items-center justify-center max-w-md">
                  {cameraStream ? (
                    <img 
                      src={cameraStream} 
                      alt="Camera feed" 
                      className="w-full h-full object-cover rounded-lg"
                    />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <Camera className="w-12 h-12 mx-auto mb-2 opacity-50" />
                      <p>Waiting for camera feed...</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Actions */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm">Admin Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full justify-start"
                  onClick={() => setShowWarningDialog(true)}
                >
                  <MessageSquare className="w-4 h-4 mr-2" />
                  Send Warning
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-success hover:text-success"
                  onClick={() => setShowCompleteDialog(true)}
                >
                  <CheckCircle className="w-4 h-4 mr-2" />
                  Mark Complete
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-destructive hover:text-destructive"
                  onClick={() => setShowTerminateDialog(true)}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Terminate Exam
                </Button>
              </CardContent>
            </Card>

            {/* Proctoring Flags */}
            <Card className="glass-card">
              <CardHeader>
                <CardTitle className="text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  Proctoring Alerts ({flags.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {flags.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No alerts recorded
                  </p>
                ) : (
                  <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {flags.map((flag) => (
                      <div
                        key={flag.id}
                        className={`p-3 rounded-lg border ${getFlagColor(flag.flag_type)}`}
                      >
                        <div className="flex items-start gap-2">
                          {getFlagIcon(flag.flag_type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium capitalize">
                              {flag.flag_type.replace(/_/g, ' ')}
                            </p>
                            <p className="text-xs opacity-80 truncate">
                              {flag.description}
                            </p>
                            <p className="text-xs opacity-60 mt-1">
                              {new Date(flag.created_at).toLocaleTimeString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </main>

      {/* Warning Dialog */}
      <Dialog open={showWarningDialog} onOpenChange={setShowWarningDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Warning to Student</DialogTitle>
            <DialogDescription>
              This message will be displayed to the student immediately.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Enter your warning message..."
            value={warningMessage}
            onChange={(e) => setWarningMessage(e.target.value)}
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowWarningDialog(false)}>
              Cancel
            </Button>
            <Button onClick={sendWarning} disabled={loading || !warningMessage.trim()}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Send Warning
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Terminate Dialog */}
      <Dialog open={showTerminateDialog} onOpenChange={setShowTerminateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Terminate Exam</DialogTitle>
            <DialogDescription>
              This will immediately end the student's exam and mark it as failed.
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTerminateDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={terminateExam} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Terminate Exam
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Dialog */}
      <Dialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mark Exam as Complete</DialogTitle>
            <DialogDescription>
              This will end the student's exam session and submit their current answers.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCompleteDialog(false)}>
              Cancel
            </Button>
            <Button onClick={markComplete} disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              Mark Complete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
