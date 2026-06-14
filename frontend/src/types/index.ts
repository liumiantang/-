export interface QuestionBank {
  id: number;
  name: string;
  description: string;
  question_count: number;
  created_at: string;
}

export interface Question {
  id: number;
  bank_id: number;
  type: 'single_choice' | 'multi_choice' | 'true_false' | 'fill_blank' | 'essay';
  difficulty: number;
  tags: string[];
  content: string;
  options: Record<string, string>;
  answer: string;
  explanation: string;
}

export interface QuizQuestion {
  answer_id: number;
  question_id: number;
  type: string;
  content: string;
  options: Record<string, string>;
  user_answer: string;
  is_correct: boolean | null;
  explanation: string;
  correct_answer: string;
}

export interface QuizSession {
  session_id: number;
  is_finished: boolean;
  total_questions: number;
  score: number | null;
  questions: QuizQuestion[];
}

export interface QuizHistoryItem {
  id: number;
  total_questions: number;
  correct_count: number;
  score: number;
  started_at: string;
  finished_at: string;
}

export interface StartQuizParams {
  bank_ids: number[];
  count: number;
  difficulty_min: number;
  difficulty_max: number;
  tags?: string[];
  type_filter?: string[];
  exclude_previous_correct: boolean;
  mode: 'practice' | 'exam';
}
