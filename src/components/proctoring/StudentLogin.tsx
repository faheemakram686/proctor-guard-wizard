import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Student, Exam } from '@/types/exam';

interface StudentLoginProps {
  onLogin: (student: Student, exam: Exam) => void;
}

export function StudentLogin({ onLogin }: StudentLoginProps) {
  const [nationalId, setNationalId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nationalId.trim()) {
      setError('Please enter your National ID');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch student by national ID
      const { data: student, error: studentError } = await supabase
        .from('students')
        .select('*')
        .eq('national_id', nationalId.trim())
        .maybeSingle();

      if (studentError) throw studentError;
      
      if (!student) {
        setError('No student found with this National ID. Please check and try again.');
        setIsLoading(false);
        return;
      }

      // Fetch active exam
      const { data: exam, error: examError } = await supabase
        .from('exams')
        .select('*')
        .eq('is_active', true)
        .limit(1)
        .maybeSingle();

      if (examError) throw examError;

      if (!exam) {
        setError('No active exams available at this time.');
        setIsLoading(false);
        return;
      }

      onLogin(student as Student, exam as Exam);
    } catch (err) {
      console.error('Login error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/30">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-80 h-80 bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-accent/5 rounded-full blur-3xl" />
      </div>

      <Card className="w-full max-w-md glass-card animate-scale-in relative z-10">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 w-16 h-16 rounded-2xl gradient-primary flex items-center justify-center shadow-lg animate-pulse-glow">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-bold">Secure Exam Portal</CardTitle>
          <CardDescription className="text-base">
            Enter your National ID to begin the proctored examination
          </CardDescription>
        </CardHeader>

        <CardContent className="pt-4">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="nationalId" className="text-sm font-medium text-foreground">
                National ID / Government ID
              </label>
              <Input
                id="nationalId"
                type="text"
                placeholder="Enter your National ID"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                className="h-12 text-base"
                autoComplete="off"
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm animate-fade-in">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <Button 
              type="submit" 
              className="w-full h-12 text-base font-semibold gradient-primary hover:opacity-90 transition-opacity"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 mr-2 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Continue to Exam'
              )}
            </Button>

            <p className="text-center text-xs text-muted-foreground">
              This is a proctored examination. Your camera and microphone will be used for identity verification and monitoring.
            </p>

            <div className="pt-4 border-t border-border">
              <Link to="/admin/auth" className="block">
                <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground">
                  Admin Portal →
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}