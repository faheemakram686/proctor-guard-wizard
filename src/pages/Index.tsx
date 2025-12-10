import { useState, useCallback } from 'react';
import { StudentLogin } from '@/components/proctoring/StudentLogin';
import { SystemCheck } from '@/components/proctoring/SystemCheck';
import { FaceVerification } from '@/components/proctoring/FaceVerification';
import { ExamInstructions } from '@/components/proctoring/ExamInstructions';
import { ExamInterface } from '@/components/proctoring/ExamInterface';
import { ExamResults } from '@/components/proctoring/ExamResults';
import { supabase } from '@/integrations/supabase/client';
import type { Student, Exam, ExamAttempt, WizardStep } from '@/types/exam';

const Index = () => {
  const [step, setStep] = useState<WizardStep>('login');
  const [student, setStudent] = useState<Student | null>(null);
  const [exam, setExam] = useState<Exam | null>(null);
  const [attempt, setAttempt] = useState<ExamAttempt | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [finalScore, setFinalScore] = useState<number>(0);
  const [passed, setPassed] = useState<boolean>(false);

  const handleLogin = useCallback((loggedStudent: Student, activeExam: Exam) => {
    setStudent(loggedStudent);
    setExam(activeExam);
    setStep('system-check');
  }, []);

  const handleSystemCheckComplete = useCallback(() => {
    setStep('face-verification');
  }, []);

  const handleFaceVerified = useCallback(async (image: string) => {
    setCapturedImage(image);
    setStep('instructions');
  }, []);

  const handleStartExam = useCallback(async () => {
    if (!student || !exam) return;

    try {
      const { data, error } = await supabase
        .from('exam_attempts')
        .insert({
          student_id: student.id,
          exam_id: exam.id,
          face_verified: true,
          verification_image_url: capturedImage,
        })
        .select()
        .single();

      if (error) throw error;

      setAttempt(data as ExamAttempt);
      setStep('exam');
    } catch (error) {
      console.error('Failed to create exam attempt:', error);
    }
  }, [student, exam, capturedImage]);

  const handleExamComplete = useCallback((score: number, didPass: boolean) => {
    setFinalScore(score);
    setPassed(didPass);
    setStep('results');
  }, []);

  const handleRetake = useCallback(() => {
    setStep('login');
    setStudent(null);
    setExam(null);
    setAttempt(null);
    setCapturedImage(null);
    setFinalScore(0);
    setPassed(false);
  }, []);

  return (
    <>
      {step === 'login' && (
        <StudentLogin onLogin={handleLogin} />
      )}

      {step === 'system-check' && student && (
        <SystemCheck
          student={student}
          onComplete={handleSystemCheckComplete}
          onBack={() => setStep('login')}
        />
      )}

      {step === 'face-verification' && student && (
        <FaceVerification
          student={student}
          onSuccess={handleFaceVerified}
          onBack={() => setStep('system-check')}
        />
      )}

      {step === 'instructions' && exam && (
        <ExamInstructions
          exam={exam}
          onStart={handleStartExam}
          onBack={() => setStep('face-verification')}
        />
      )}

      {step === 'exam' && exam && attempt && (
        <ExamInterface
          exam={exam}
          attempt={attempt}
          onComplete={handleExamComplete}
        />
      )}

      {step === 'results' && exam && (
        <ExamResults
          exam={exam}
          score={finalScore}
          passed={passed}
          onRetake={handleRetake}
        />
      )}
    </>
  );
};

export default Index;