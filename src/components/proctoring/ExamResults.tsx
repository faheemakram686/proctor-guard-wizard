import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, XCircle, Trophy, RefreshCw } from 'lucide-react';
import type { Exam } from '@/types/exam';

interface ExamResultsProps {
  exam: Exam;
  score: number;
  passed: boolean;
  onRetake: () => void;
}

export function ExamResults({ exam, score, passed, onRetake }: ExamResultsProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/30">
      <Card className="w-full max-w-md glass-card animate-scale-in text-center">
        <CardHeader className="pb-4">
          <div className={`mx-auto mb-4 w-20 h-20 rounded-full flex items-center justify-center ${
            passed ? 'bg-success/10' : 'bg-destructive/10'
          }`}>
            {passed ? (
              <Trophy className="w-10 h-10 text-success" />
            ) : (
              <XCircle className="w-10 h-10 text-destructive" />
            )}
          </div>
          <CardTitle className="text-2xl font-bold">
            {passed ? 'Congratulations!' : 'Exam Completed'}
          </CardTitle>
          <CardDescription className="text-base">
            {exam.title}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          <div className="py-6">
            <div className={`text-6xl font-bold ${passed ? 'text-success' : 'text-destructive'}`}>
              {score}%
            </div>
            <p className="text-muted-foreground mt-2">
              {passed ? 'You passed!' : 'Better luck next time'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-muted-foreground">Your Score</p>
              <p className="text-xl font-semibold text-foreground">{score}%</p>
            </div>
            <div className="p-3 rounded-lg bg-muted/50">
              <p className="text-muted-foreground">Passing Score</p>
              <p className="text-xl font-semibold text-foreground">{exam.passing_score}%</p>
            </div>
          </div>

          <div className={`flex items-center justify-center gap-2 p-4 rounded-lg ${
            passed ? 'bg-success/10 text-success' : 'bg-destructive/10 text-destructive'
          }`}>
            {passed ? (
              <>
                <CheckCircle className="w-5 h-5" />
                <span className="font-medium">You have successfully passed the exam</span>
              </>
            ) : (
              <>
                <XCircle className="w-5 h-5" />
                <span className="font-medium">You did not meet the passing requirement</span>
              </>
            )}
          </div>

          <Button onClick={onRetake} variant="outline" className="w-full">
            <RefreshCw className="w-4 h-4 mr-2" />
            Take Another Exam
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}