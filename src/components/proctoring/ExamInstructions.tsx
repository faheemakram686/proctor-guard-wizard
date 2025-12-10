import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Clock, FileText, Target, AlertTriangle, Camera, Mic } from 'lucide-react';
import type { Exam } from '@/types/exam';

interface ExamInstructionsProps {
  exam: Exam;
  onStart: () => void;
  onBack: () => void;
}

export function ExamInstructions({ exam, onStart, onBack }: ExamInstructionsProps) {
  const [agreed, setAgreed] = useState(false);

  const instructions = exam.instructions?.split('\n').filter(Boolean) || [];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-background via-background to-muted/30">
      <Card className="w-full max-w-2xl glass-card animate-slide-up">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold">{exam.title}</CardTitle>
          <CardDescription className="text-base">
            {exam.description}
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Exam Info Cards */}
          <div className="grid grid-cols-3 gap-4">
            <div className="p-4 rounded-lg bg-primary/5 border border-primary/10 text-center">
              <Clock className="w-6 h-6 mx-auto text-primary mb-2" />
              <p className="text-2xl font-bold text-foreground">{exam.duration_minutes}</p>
              <p className="text-xs text-muted-foreground">Minutes</p>
            </div>
            <div className="p-4 rounded-lg bg-accent/5 border border-accent/10 text-center">
              <FileText className="w-6 h-6 mx-auto text-accent mb-2" />
              <p className="text-2xl font-bold text-foreground">MCQ</p>
              <p className="text-xs text-muted-foreground">Format</p>
            </div>
            <div className="p-4 rounded-lg bg-success/5 border border-success/10 text-center">
              <Target className="w-6 h-6 mx-auto text-success mb-2" />
              <p className="text-2xl font-bold text-foreground">{exam.passing_score}%</p>
              <p className="text-xs text-muted-foreground">To Pass</p>
            </div>
          </div>

          {/* Proctoring Notice */}
          <div className="p-4 rounded-lg bg-warning/10 border border-warning/20">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <h4 className="font-semibold text-foreground mb-1">Live Proctoring Active</h4>
                <p className="text-sm text-muted-foreground">
                  This exam is monitored in real-time. The following will be tracked:
                </p>
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Camera className="w-3.5 h-3.5" />
                    <span>Video Recording</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Mic className="w-3.5 h-3.5" />
                    <span>Audio Monitoring</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Instructions */}
          <div className="space-y-3">
            <h3 className="font-semibold text-foreground">Exam Rules & Guidelines</h3>
            <div className="space-y-2">
              {instructions.length > 0 ? (
                instructions.map((instruction, index) => (
                  <div key={index} className="flex items-start gap-3 text-sm">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                      {index + 1}
                    </span>
                    <p className="text-muted-foreground pt-0.5">{instruction}</p>
                  </div>
                ))
              ) : (
                <>
                  <div className="flex items-start gap-3 text-sm">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">1</span>
                    <p className="text-muted-foreground pt-0.5">Remain visible to the camera throughout the exam</p>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">2</span>
                    <p className="text-muted-foreground pt-0.5">Do not switch tabs or windows during the exam</p>
                  </div>
                  <div className="flex items-start gap-3 text-sm">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">3</span>
                    <p className="text-muted-foreground pt-0.5">No additional persons are allowed in the room</p>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Agreement */}
          <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border border-border">
            <Checkbox
              id="agreement"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked === true)}
              className="mt-0.5"
            />
            <label htmlFor="agreement" className="text-sm text-muted-foreground cursor-pointer">
              I have read and agree to follow all exam rules and guidelines. I understand that any violation may result in disqualification.
            </label>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button variant="outline" onClick={onBack} className="flex-1">
              Back
            </Button>
            <Button
              onClick={onStart}
              disabled={!agreed}
              className="flex-1 gradient-primary font-semibold"
            >
              Start Exam
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}