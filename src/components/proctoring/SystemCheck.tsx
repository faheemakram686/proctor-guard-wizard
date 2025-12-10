import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Mic, Monitor, Check, X, Loader2, AlertTriangle } from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import type { Student } from '@/types/exam';

interface SystemCheckProps {
  student: Student;
  onComplete: () => void;
  onBack: () => void;
}

interface CheckItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: 'pending' | 'checking' | 'success' | 'error';
  message?: string;
}

export function SystemCheck({ student, onComplete, onBack }: SystemCheckProps) {
  const { videoRef, isActive, error, startCamera, checkMicrophone } = useCamera();
  const [checks, setChecks] = useState<CheckItem[]>([
    { id: 'browser', label: 'Browser Compatibility', icon: <Monitor className="w-5 h-5" />, status: 'pending' },
    { id: 'camera', label: 'Camera Access', icon: <Camera className="w-5 h-5" />, status: 'pending' },
    { id: 'microphone', label: 'Microphone Access', icon: <Mic className="w-5 h-5" />, status: 'pending' },
  ]);
  const [isRunning, setIsRunning] = useState(false);

  const updateCheck = (id: string, status: CheckItem['status'], message?: string) => {
    setChecks(prev => prev.map(check => 
      check.id === id ? { ...check, status, message } : check
    ));
  };

  const runChecks = async () => {
    setIsRunning(true);

    // Browser check
    updateCheck('browser', 'checking');
    await new Promise(resolve => setTimeout(resolve, 500));
    const isCompatible = 'mediaDevices' in navigator && 'getUserMedia' in navigator.mediaDevices;
    updateCheck('browser', isCompatible ? 'success' : 'error', 
      isCompatible ? 'Compatible browser detected' : 'Browser not supported');

    if (!isCompatible) {
      setIsRunning(false);
      return;
    }

    // Camera check
    updateCheck('camera', 'checking');
    const cameraSuccess = await startCamera();
    updateCheck('camera', cameraSuccess ? 'success' : 'error',
      cameraSuccess ? 'Camera ready' : 'Camera access denied');

    if (!cameraSuccess) {
      setIsRunning(false);
      return;
    }

    // Microphone check
    updateCheck('microphone', 'checking');
    await new Promise(resolve => setTimeout(resolve, 500));
    const micSuccess = checkMicrophone();
    updateCheck('microphone', micSuccess ? 'success' : 'error',
      micSuccess ? 'Microphone ready' : 'Microphone access denied');

    setIsRunning(false);
  };

  useEffect(() => {
    const timer = setTimeout(runChecks, 500);
    return () => clearTimeout(timer);
  }, []);

  const allPassed = checks.every(check => check.status === 'success');
  const hasFailed = checks.some(check => check.status === 'error');

  const getStatusIcon = (status: CheckItem['status']) => {
    switch (status) {
      case 'pending':
        return <div className="w-5 h-5 rounded-full border-2 border-muted-foreground/30" />;
      case 'checking':
        return <Loader2 className="w-5 h-5 text-primary animate-spin" />;
      case 'success':
        return <Check className="w-5 h-5 text-success" />;
      case 'error':
        return <X className="w-5 h-5 text-destructive" />;
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/30">
      <Card className="w-full max-w-2xl glass-card animate-slide-up">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">System Requirements Check</CardTitle>
          <CardDescription className="text-base">
            Welcome, <span className="font-semibold text-foreground">{student.full_name}</span>! 
            Let's verify your system is ready for the exam.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Camera Preview */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-muted-foreground">Camera Preview</h3>
              <div className="relative aspect-video bg-muted rounded-lg overflow-hidden border border-border">
                {isActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    {error ? (
                      <div className="text-center text-destructive p-4">
                        <AlertTriangle className="w-8 h-8 mx-auto mb-2" />
                        <p className="text-sm">{error}</p>
                      </div>
                    ) : (
                      <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* System Checks */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-muted-foreground">System Status</h3>
              <div className="space-y-3">
                {checks.map((check) => (
                  <div
                    key={check.id}
                    className={`flex items-center gap-3 p-4 rounded-lg border transition-all duration-300 ${
                      check.status === 'success' ? 'bg-success/5 border-success/20' :
                      check.status === 'error' ? 'bg-destructive/5 border-destructive/20' :
                      'bg-muted/50 border-border'
                    }`}
                  >
                    <div className="text-muted-foreground">{check.icon}</div>
                    <div className="flex-1">
                      <p className="font-medium text-sm">{check.label}</p>
                      {check.message && (
                        <p className={`text-xs ${
                          check.status === 'success' ? 'text-success' :
                          check.status === 'error' ? 'text-destructive' :
                          'text-muted-foreground'
                        }`}>
                          {check.message}
                        </p>
                      )}
                    </div>
                    {getStatusIcon(check.status)}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              variant="outline"
              onClick={onBack}
              className="flex-1"
              disabled={isRunning}
            >
              Back
            </Button>
            {hasFailed ? (
              <Button
                onClick={runChecks}
                className="flex-1"
                disabled={isRunning}
              >
                {isRunning ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Checking...
                  </>
                ) : (
                  'Retry Checks'
                )}
              </Button>
            ) : (
              <Button
                onClick={onComplete}
                className="flex-1 gradient-primary"
                disabled={!allPassed || isRunning}
              >
                Continue to Verification
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}