export interface Student {
  id: string;
  national_id: string;
  full_name: string;
  email: string | null;
  profile_image_url: string | null;
}

export interface Exam {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  passing_score: number;
  instructions: string | null;
  is_active: boolean;
}

export interface ExamQuestion {
  id: string;
  exam_id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  points: number;
  question_order: number;
}

export interface ExamAttempt {
  id: string;
  student_id: string;
  exam_id: string;
  started_at: string;
  completed_at: string | null;
  score: number | null;
  passed: boolean | null;
  face_verified: boolean;
  verification_image_url: string | null;
}

export interface ExamAnswer {
  id: string;
  attempt_id: string;
  question_id: string;
  selected_option: 'A' | 'B' | 'C' | 'D' | null;
  answered_at: string;
}

export interface ProctoringFlag {
  id: string;
  attempt_id: string;
  flag_type: string;
  description: string | null;
  screenshot_url: string | null;
  created_at: string;
}

export type WizardStep = 'login' | 'system-check' | 'face-verification' | 'instructions' | 'exam' | 'results';