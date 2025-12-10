import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { AlertTriangle, ChevronLeft, ChevronRight, Clock, Flag, Send, Camera } from 'lucide-react';
import { useCamera } from '@/hooks/useCamera';
import { useExamTimer } from '@/hooks/useExamTimer';
import { useProctoring } from '@/hooks/useProctoring';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import type { Exam, ExamQuestion, ExamAttempt } from '@/types/exam';

interface ExamInterfaceProps {
  exam: Exam;
  attempt: ExamAttempt;
  onComplete: (score: number, passed: boolean) => void;
}

export function ExamInterface({ exam, attempt, onComplete }: ExamInterfaceProps) {
  const [questions, setQuestions] = useState<ExamQuestion[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, 'A' | 'B' | 'C' | 'D'>>({});
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [proctoringAlerts, setProctoringAlerts] = useState<string[]>([]);

  const { videoRef, startCamera, isActive } = useCamera();

  const handleTimeUp = useCallback(() => {
    toast({
      title: "Time's up!",
      description: "Your exam is being submitted automatically.",
      variant: "destructive",
    });
    handleSubmit();
  }, []);

  const { formattedTime, isLowTime, isCriticalTime, start: startTimer } = useExamTimer(
    exam.duration_minutes,
    handleTimeUp
  );

  const handleFlag = useCallback((type: string, description: string) => {
    setProctoringAlerts(prev => [...prev.slice(-4), `${type}: ${description}`]);
  }, []);

  useProctoring({ attemptId: attempt.id, onFlag: handleFlag });

  useEffect(() => {
    const loadQuestions = async () => {
      const { data, error } = await supabase
        .from('exam_questions')
        .select('*')
        .eq('exam_id', exam.id)
        .order('question_order', { ascending: true });

      if (error) {
        console.error('Failed to load questions:', error);
        return;
      }

      setQuestions(data as ExamQuestion[]);
    };

    loadQuestions();
    startCamera();
    startTimer();
  }, [exam.id, startCamera, startTimer]);

  const currentQuestion = questions[currentIndex];
  const progress = ((currentIndex + 1) / questions.length) * 100;
  const answeredCount = Object.keys(answers).length;

  const selectAnswer = (option: 'A' | 'B' | 'C' | 'D') => {
    if (!currentQuestion) return;
    setAnswers(prev => ({ ...prev, [currentQuestion.id]: option }));
  };

  const toggleFlag = () => {
    if (!currentQuestion) return;
    setFlagged(prev => {
      const next = new Set(prev);
      if (next.has(currentQuestion.id)) {
        next.delete(currentQuestion.id);
      } else {
        next.add(currentQuestion.id);
      }
      return next;
    });
  };

  const goToQuestion = (index: number) => {
    if (index >= 0 && index < questions.length) {
      setCurrentIndex(index);
    }
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);

    try {
      // Calculate score
      let correctCount = 0;
      let totalPoints = 0;

      for (const question of questions) {
        totalPoints += question.points;
        if (answers[question.id] === question.correct_option) {
          correctCount += question.points;
        }

        // Save answer
        if (answers[question.id]) {
          await supabase.from('exam_answers').upsert({
            attempt_id: attempt.id,
            question_id: question.id,
            selected_option: answers[question.id],
          });
        }
      }

      const score = Math.round((correctCount / totalPoints) * 100);
      const passed = score >= exam.passing_score;

      // Update attempt
      await supabase
        .from('exam_attempts')
        .update({
          completed_at: new Date().toISOString(),
          score,
          passed,
        })
        .eq('id', attempt.id);

      onComplete(score, passed);
    } catch (error) {
      console.error('Failed to submit exam:', error);
      toast({
        title: "Submission failed",
        description: "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="mt-4 text-muted-foreground">Loading questions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card/95 backdrop-blur-lg border-b border-border">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="font-semibold text-foreground">{exam.title}</h1>
              <p className="text-xs text-muted-foreground">
                Question {currentIndex + 1} of {questions.length}
              </p>
            </div>

            <div className="flex items-center gap-4">
              {/* Timer */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-lg font-mono font-semibold ${
                isCriticalTime ? 'bg-destructive text-destructive-foreground animate-pulse' :
                isLowTime ? 'bg-warning text-warning-foreground' :
                'bg-muted text-foreground'
              }`}>
                <Clock className="w-4 h-4" />
                {formattedTime}
              </div>

              {/* Camera indicator */}
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className={`w-2 h-2 rounded-full ${isActive ? 'bg-success animate-pulse' : 'bg-destructive'}`} />
                <Camera className="w-4 h-4" />
              </div>
            </div>
          </div>
          <Progress value={progress} className="mt-2 h-1" />
        </div>
      </header>

      <div className="container mx-auto px-4 py-6">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Main Question Area */}
          <div className="lg:col-span-3 space-y-6">
            {/* Question Card */}
            <Card className="glass-card">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-6">
                  <span className="text-xs font-medium text-primary bg-primary/10 px-3 py-1 rounded-full">
                    Question {currentIndex + 1}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={toggleFlag}
                    className={flagged.has(currentQuestion.id) ? 'text-warning' : 'text-muted-foreground'}
                  >
                    <Flag className="w-4 h-4 mr-1" />
                    {flagged.has(currentQuestion.id) ? 'Flagged' : 'Flag for Review'}
                  </Button>
                </div>

                <h2 className="text-xl font-semibold text-foreground mb-6">
                  {currentQuestion.question_text}
                </h2>

                <div className="space-y-3">
                  {(['A', 'B', 'C', 'D'] as const).map((option) => {
                    const optionText = currentQuestion[`option_${option.toLowerCase()}` as keyof ExamQuestion];
                    const isSelected = answers[currentQuestion.id] === option;

                    return (
                      <button
                        key={option}
                        onClick={() => selectAnswer(option)}
                        className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                          isSelected
                            ? 'border-primary bg-primary/10 shadow-md'
                            : 'border-border bg-card hover:border-primary/50 hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
                            isSelected
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {option}
                          </span>
                          <span className="text-foreground">{optionText as string}</span>
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Navigation */}
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-border">
                  <Button
                    variant="outline"
                    onClick={() => goToQuestion(currentIndex - 1)}
                    disabled={currentIndex === 0}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Previous
                  </Button>

                  {currentIndex === questions.length - 1 ? (
                    <Button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className="gradient-primary font-semibold"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {isSubmitting ? 'Submitting...' : 'Submit Exam'}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => goToQuestion(currentIndex + 1)}
                      className="gradient-primary"
                    >
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Camera Preview */}
            <Card className="glass-card overflow-hidden">
              <div className="aspect-video bg-muted">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="w-full h-full object-cover scale-x-[-1]"
                />
              </div>
            </Card>

            {/* Question Navigator */}
            <Card className="glass-card">
              <CardContent className="p-4">
                <h3 className="font-medium text-sm mb-3 text-foreground">Questions</h3>
                <div className="grid grid-cols-5 gap-2">
                  {questions.map((q, idx) => (
                    <button
                      key={q.id}
                      onClick={() => goToQuestion(idx)}
                      className={`w-8 h-8 rounded-md text-xs font-medium transition-all ${
                        idx === currentIndex
                          ? 'bg-primary text-primary-foreground'
                          : answers[q.id]
                          ? 'bg-success/20 text-success border border-success/30'
                          : flagged.has(q.id)
                          ? 'bg-warning/20 text-warning border border-warning/30'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      }`}
                    >
                      {idx + 1}
                    </button>
                  ))}
                </div>

                <div className="mt-4 pt-4 border-t border-border text-xs text-muted-foreground space-y-1">
                  <p className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-success/20 border border-success/30" />
                    Answered ({answeredCount}/{questions.length})
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm bg-warning/20 border border-warning/30" />
                    Flagged ({flagged.size})
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Proctoring Alerts */}
            {proctoringAlerts.length > 0 && (
              <Card className="glass-card border-warning/30">
                <CardContent className="p-4">
                  <h3 className="font-medium text-sm mb-2 text-warning flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    Alerts
                  </h3>
                  <div className="space-y-1 max-h-32 overflow-y-auto">
                    {proctoringAlerts.slice(-3).map((alert, idx) => (
                      <p key={idx} className="text-xs text-muted-foreground truncate">
                        {alert}
                      </p>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}