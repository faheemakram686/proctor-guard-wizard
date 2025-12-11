import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { LiveProctoringView } from '@/components/admin/LiveProctoringView';
import { 
  Shield, LogOut, Users, MonitorPlay, AlertTriangle, 
  Loader2, RefreshCw 
} from 'lucide-react';
import type { User } from '@supabase/supabase-js';

interface ActiveSession {
  id: string;
  attempt_id: string;
  student_id: string;
  is_active: boolean;
  started_at: string;
  student: {
    full_name: string;
    national_id: string;
  };
  exam_attempt: {
    exam: {
      title: string;
    };
  };
}

export default function AdminDashboard() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<ActiveSession | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!session?.user) {
          navigate('/admin/auth');
          return;
        }
        
        // Verify admin role
        const { data: roles } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', session.user.id)
          .eq('role', 'admin')
          .single();

        if (!roles) {
          await supabase.auth.signOut();
          navigate('/admin/auth');
          return;
        }

        setUser(session.user);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session?.user) {
        navigate('/admin/auth');
        return;
      }

      const { data: roles } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', session.user.id)
        .eq('role', 'admin')
        .single();

      if (!roles) {
        await supabase.auth.signOut();
        navigate('/admin/auth');
        return;
      }

      setUser(session.user);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (!user) return;

    loadActiveSessions();

    // Subscribe to realtime updates
    const channel = supabase
      .channel('proctoring-sessions')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'proctoring_sessions',
        },
        () => {
          loadActiveSessions();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  const loadActiveSessions = async () => {
    try {
      const { data, error } = await supabase
        .from('proctoring_sessions')
        .select(`
          id,
          attempt_id,
          student_id,
          is_active,
          started_at,
          student:students(full_name, national_id),
          exam_attempt:exam_attempts(exam:exams(title))
        `)
        .eq('is_active', true)
        .order('started_at', { ascending: false });

      if (error) throw error;

      // Transform the data to match our interface
      const sessions = (data || []).map((session: any) => ({
        ...session,
        student: session.student,
        exam_attempt: session.exam_attempt,
      }));

      setActiveSessions(sessions);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadActiveSessions();
    setRefreshing(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/admin/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (selectedSession) {
    return (
      <LiveProctoringView
        session={selectedSession}
        onBack={() => setSelectedSession(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Shield className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h1 className="font-bold text-lg">Proctoring Admin</h1>
              <p className="text-sm text-muted-foreground">{user?.email}</p>
            </div>
          </div>
          <Button variant="outline" onClick={handleSignOut}>
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Active Sessions</p>
                  <p className="text-3xl font-bold text-primary">{activeSessions.length}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <MonitorPlay className="w-6 h-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Students Online</p>
                  <p className="text-3xl font-bold text-success">{activeSessions.length}</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-success/10 flex items-center justify-center">
                  <Users className="w-6 h-6 text-success" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="glass-card">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Alerts Today</p>
                  <p className="text-3xl font-bold text-warning">0</p>
                </div>
                <div className="w-12 h-12 rounded-2xl bg-warning/10 flex items-center justify-center">
                  <AlertTriangle className="w-6 h-6 text-warning" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Active Sessions */}
        <Card className="glass-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <MonitorPlay className="w-5 h-5" />
                Live Exam Sessions
              </CardTitle>
              <CardDescription>
                Click on a session to view live screen and camera
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardHeader>
          <CardContent>
            {activeSessions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <MonitorPlay className="w-12 h-12 mx-auto mb-4 opacity-50" />
                <p className="text-lg font-medium">No active exam sessions</p>
                <p className="text-sm">Sessions will appear here when students start exams</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeSessions.map((session) => (
                  <Card 
                    key={session.id} 
                    className="cursor-pointer hover:border-primary/50 transition-colors"
                    onClick={() => setSelectedSession(session)}
                  >
                    <CardContent className="pt-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <p className="font-semibold">{session.student?.full_name || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground">
                            ID: {session.student?.national_id || 'N/A'}
                          </p>
                        </div>
                        <Badge variant="default" className="bg-success text-success-foreground">
                          Live
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mb-2">
                        {session.exam_attempt?.exam?.title || 'Unknown Exam'}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Started: {new Date(session.started_at).toLocaleTimeString()}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
