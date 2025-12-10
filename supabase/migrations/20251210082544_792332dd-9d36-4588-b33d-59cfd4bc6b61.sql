-- Create students table (mock external data - will be replaced with API integration)
CREATE TABLE public.students (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  national_id TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT,
  profile_image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create exams table
CREATE TABLE public.exams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  passing_score INTEGER NOT NULL DEFAULT 70,
  instructions TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create exam questions table
CREATE TABLE public.exam_questions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option CHAR(1) NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
  points INTEGER NOT NULL DEFAULT 1,
  question_order INTEGER NOT NULL DEFAULT 0
);

-- Create exam attempts table
CREATE TABLE public.exam_attempts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE,
  score INTEGER,
  passed BOOLEAN,
  face_verified BOOLEAN NOT NULL DEFAULT false,
  verification_image_url TEXT
);

-- Create exam answers table
CREATE TABLE public.exam_answers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
  selected_option CHAR(1) CHECK (selected_option IN ('A', 'B', 'C', 'D')),
  answered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(attempt_id, question_id)
);

-- Create proctoring flags table
CREATE TABLE public.proctoring_flags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attempt_id UUID NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  flag_type TEXT NOT NULL,
  description TEXT,
  screenshot_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proctoring_flags ENABLE ROW LEVEL SECURITY;

-- Public read access for students (login verification)
CREATE POLICY "Anyone can lookup students by national_id" ON public.students FOR SELECT USING (true);

-- Public read access for exams
CREATE POLICY "Anyone can view active exams" ON public.exams FOR SELECT USING (is_active = true);

-- Public read access for exam questions
CREATE POLICY "Anyone can view exam questions" ON public.exam_questions FOR SELECT USING (true);

-- Public access for exam attempts (simplified for MVP - no auth)
CREATE POLICY "Anyone can create exam attempts" ON public.exam_attempts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view exam attempts" ON public.exam_attempts FOR SELECT USING (true);
CREATE POLICY "Anyone can update exam attempts" ON public.exam_attempts FOR UPDATE USING (true);

-- Public access for exam answers
CREATE POLICY "Anyone can create exam answers" ON public.exam_answers FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view exam answers" ON public.exam_answers FOR SELECT USING (true);
CREATE POLICY "Anyone can update exam answers" ON public.exam_answers FOR UPDATE USING (true);

-- Public access for proctoring flags
CREATE POLICY "Anyone can create proctoring flags" ON public.proctoring_flags FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can view proctoring flags" ON public.proctoring_flags FOR SELECT USING (true);

-- Insert sample student data
INSERT INTO public.students (national_id, full_name, email, profile_image_url) VALUES
('1234567890', 'John Smith', 'john.smith@email.com', 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face'),
('9876543210', 'Sarah Johnson', 'sarah.j@email.com', 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=200&h=200&fit=crop&crop=face'),
('5555555555', 'Michael Chen', 'michael.chen@email.com', 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&h=200&fit=crop&crop=face');

-- Insert sample exam
INSERT INTO public.exams (id, title, description, duration_minutes, passing_score, instructions) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Introduction to Computer Science', 'Basic concepts of programming and computer fundamentals', 30, 70, 
'1. You must remain visible to the camera throughout the exam.
2. No additional persons are allowed in the room.
3. Do not switch tabs or windows during the exam.
4. You have 30 minutes to complete all questions.
5. Each question has only one correct answer.
6. You can navigate between questions freely.
7. Make sure to submit before time runs out.');

-- Insert sample questions
INSERT INTO public.exam_questions (exam_id, question_text, option_a, option_b, option_c, option_d, correct_option, question_order) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'What does CPU stand for?', 'Central Processing Unit', 'Computer Personal Unit', 'Central Program Utility', 'Computer Processing Unit', 'A', 1),
('550e8400-e29b-41d4-a716-446655440000', 'Which of the following is a programming language?', 'HTML', 'Python', 'CSS', 'HTTP', 'B', 2),
('550e8400-e29b-41d4-a716-446655440000', 'What is the binary representation of the decimal number 5?', '100', '110', '101', '111', 'C', 3),
('550e8400-e29b-41d4-a716-446655440000', 'Which data structure follows LIFO principle?', 'Queue', 'Stack', 'Array', 'Linked List', 'B', 4),
('550e8400-e29b-41d4-a716-446655440000', 'What does RAM stand for?', 'Random Access Memory', 'Read Access Memory', 'Run Access Memory', 'Rapid Access Memory', 'A', 5);