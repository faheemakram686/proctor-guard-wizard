import { useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, Check, X, Loader2, RefreshCw, User } from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { supabase } from '@/integrations/supabase/client';
import type { Student } from '@/types/exam';

interface FaceVerificationProps {
  student: Student;
  onSuccess: (capturedImage: string) => void;
  onBack: () => void;
}

type VerificationStatus = 'idle' | 'capturing' | 'verifying' | 'success' | 'failed';

export function FaceVerification({ student, onSuccess, onBack }: FaceVerificationProps) {
  const { videoRef, isActive, startCamera, captureFrame } = useCamera();
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [status, setStatus] = useState<VerificationStatus>('idle');
  const [matchScore, setMatchScore] = useState<number | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Start camera on mount
  useState(() => {
    startCamera();
  });

  const handleCapture = useCallback(() => {
    setStatus('capturing');
    const frame = captureFrame();
    if (frame) {
      setCapturedImage(frame);
      setStatus('idle');
    } else {
      setStatus('idle');
      setErrorMessage('Failed to capture image. Please try again.');
    }
  }, [captureFrame]);

  const handleVerify = useCallback(async () => {
    if (!capturedImage || !student.profile_image_url) {
      setErrorMessage('Missing images for verification');
      return;
    }

    setStatus('verifying');
    setErrorMessage(null);

    try {
      const { data, error } = await supabase.functions.invoke('verify-face', {
        body: {
          capturedImage,
          storedImageUrl: student.profile_image_url,
        },
      });

      if (error) throw error;

      const score = data?.matchScore ?? 0;
      setMatchScore(score);

      if (score >= 70) {
        setStatus('success');
        setTimeout(() => {
          onSuccess(capturedImage);
        }, 1500);
      } else {
        setStatus('failed');
        setErrorMessage('Face verification failed. Please ensure good lighting and face the camera directly.');
      }
    } catch (err) {
      console.error('Verification error:', err);
      setStatus('failed');
      setErrorMessage('Verification service unavailable. Please try again.');
    }
  }, [capturedImage, student.profile_image_url, onSuccess]);

  const handleRetry = () => {
    setCapturedImage(null);
    setStatus('idle');
    setMatchScore(null);
    setErrorMessage(null);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/30">
      <Card className="w-full max-w-3xl glass-card animate-slide-up">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">Identity Verification</CardTitle>
          <CardDescription className="text-base">
            We need to verify your identity by comparing your face with your profile photo
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Stored Photo */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-muted-foreground text-center">Profile Photo</h3>
              <div className="relative aspect-square max-w-[250px] mx-auto bg-muted rounded-xl overflow-hidden border-2 border-border">
                {student.profile_image_url ? (
                  <img
                    src={student.profile_image_url}
                    alt={student.full_name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <User className="w-16 h-16 text-muted-foreground" />
                  </div>
                )}
              </div>
              <p className="text-center text-sm font-medium">{student.full_name}</p>
            </div>

            {/* Live Camera / Captured Image */}
            <div className="space-y-3">
              <h3 className="font-medium text-sm text-muted-foreground text-center">
                {capturedImage ? 'Captured Photo' : 'Live Camera'}
              </h3>
              <div className="relative aspect-square max-w-[250px] mx-auto bg-muted rounded-xl overflow-hidden border-2 border-border">
                {capturedImage ? (
                  <img
                    src={capturedImage}
                    alt="Captured"
                    className="w-full h-full object-cover"
                  />
                ) : isActive ? (
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover scale-x-[-1]"
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 text-muted-foreground animate-spin" />
                  </div>
                )}

                {/* Status overlay */}
                {status === 'verifying' && (
                  <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="w-10 h-10 text-primary animate-spin mx-auto" />
                      <p className="mt-2 text-sm font-medium">Verifying...</p>
                    </div>
                  </div>
                )}

                {status === 'success' && (
                  <div className="absolute inset-0 bg-success/90 flex items-center justify-center animate-fade-in">
                    <div className="text-center text-success-foreground">
                      <Check className="w-16 h-16 mx-auto" />
                      <p className="mt-2 font-semibold">Verified!</p>
                      {matchScore && <p className="text-sm opacity-80">{matchScore}% match</p>}
                    </div>
                  </div>
                )}

                {status === 'failed' && (
                  <div className="absolute inset-0 bg-destructive/90 flex items-center justify-center animate-fade-in">
                    <div className="text-center text-destructive-foreground">
                      <X className="w-16 h-16 mx-auto" />
                      <p className="mt-2 font-semibold">Failed</p>
                      {matchScore !== null && <p className="text-sm opacity-80">{matchScore}% match</p>}
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex gap-2 justify-center">
                {!capturedImage && status !== 'verifying' && (
                  <Button
                    onClick={handleCapture}
                    disabled={!isActive || status === 'capturing'}
                    className="gradient-primary"
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Capture Photo
                  </Button>
                )}

                {capturedImage && status === 'idle' && (
                  <>
                    <Button variant="outline" onClick={handleRetry}>
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Retake
                    </Button>
                    <Button onClick={handleVerify} className="gradient-primary">
                      Verify Identity
                    </Button>
                  </>
                )}

                {status === 'failed' && (
                  <Button onClick={handleRetry} variant="outline">
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Try Again
                  </Button>
                )}
              </div>
            </div>
          </div>

          {errorMessage && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm text-center animate-fade-in">
              {errorMessage}
            </div>
          )}

          <div className="flex gap-3 pt-4 border-t border-border">
            <Button
              variant="outline"
              onClick={onBack}
              className="flex-1"
              disabled={status === 'verifying'}
            >
              Back
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}