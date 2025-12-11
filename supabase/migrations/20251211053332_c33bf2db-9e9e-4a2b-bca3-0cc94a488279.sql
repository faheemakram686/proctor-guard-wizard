-- Add user_id column to students table FIRST
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON public.students(user_id);

-- Create admin role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'student');

-- Create user_roles table for admin access
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- RLS policy for user_roles
CREATE POLICY "Users can view own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

-- Create table for live proctoring sessions
CREATE TABLE public.proctoring_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID REFERENCES public.exam_attempts(id) ON DELETE CASCADE NOT NULL,
    student_id UUID REFERENCES public.students(id) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    screen_stream_id TEXT,
    camera_stream_id TEXT,
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    ended_at TIMESTAMP WITH TIME ZONE,
    UNIQUE (attempt_id)
);

ALTER TABLE public.proctoring_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can manage proctoring sessions"
ON public.proctoring_sessions
FOR ALL
USING (true)
WITH CHECK (true);

-- Create table for admin actions on exams
CREATE TABLE public.admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    attempt_id UUID REFERENCES public.exam_attempts(id) ON DELETE CASCADE NOT NULL,
    admin_id UUID REFERENCES auth.users(id) NOT NULL,
    action_type TEXT NOT NULL CHECK (action_type IN ('terminate', 'complete', 'warning', 'flag_review')),
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage actions"
ON public.admin_actions
FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students can view own warnings"
ON public.admin_actions
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.exam_attempts ea
        JOIN public.students s ON s.id = ea.student_id
        WHERE ea.id = admin_actions.attempt_id
        AND s.user_id = auth.uid()
    )
);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.proctoring_sessions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_actions;