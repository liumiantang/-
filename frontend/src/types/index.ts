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
  ai_score: number | null;
  ai_feedback: string;
}

export interface QuizSession {
  session_id: number;
  is_finished: boolean;
  total_questions: number;
  score: number | null;
  pending_count?: number;
  time_limit?: number;
  started_at?: string;
  questions: QuizQuestion[];
}

export interface QuizHistoryItem {
  id: number;
  total_questions: number;
  correct_count: number;
  score: number;
  started_at: string;
  finished_at: string | null;
}

export interface StartQuizParams {
  bank_ids: number[];
  count: number;
  difficulty_min: number;
  difficulty_max: number;
  tags?: string[];
  type_filter?: string[];
  exclude_previous_correct: boolean;
  mode: 'practice' | 'exam' | 'review';
  time_limit?: number;
}

export interface AiConfig {
  provider: string;
  has_key: boolean;
  api_base: string;
  model: string;
  presets: Record<string, { api_base: string; model: string }>;
}

export interface AiGenerateResult {
  imported: number;
  questions: Question[];
}

export interface UserStats {
  total_answers: number;
  correct_answers: number;
  accuracy: number;
  max_streak: number;
  total_study_days: number;
  consecutive_days: number;
  checked_in_today: boolean;
  today_sessions: number;
  study_dates: string[];
  tier: {
    name: string;
    icon: string;
    color: string;
    stars: number;
    star_tier_name: string;
  };
  xp: number;
  xp_level: number;
  xp_current: number;
  xp_next: number;
}

export interface ReviewDue {
  count: number;
  due_count: number;
  mastered_count: number;
  stage_distribution: Record<string, number>;
  questions: Question[];
}

export interface ReviewStats {
  total_scheduled: number;
  due_count: number;
  mastered_count: number;
  stage_distribution: Record<string, number>;
}

export interface SubmitAnswerResponse {
  is_correct: boolean | null;
  correct_answer: string;
  explanation: string;
  needs_grading?: boolean;
  review?: {
    stage: number;
    next_review_at: string | null;
    review_count: number;
  };
}

export interface GradeEssayResponse {
  score: number;
  feedback: string;
  answer_id: number;
}

export interface FavoriteItem {
  favorite_id: number;
  question_id: number;
  type: string;
  difficulty: number;
  tags: string[];
  content: string;
  options: Record<string, string>;
  answer: string;
  explanation: string;
  bank_id: number;
}

export interface AiUsage {
  total_calls: number;
  total_tokens: number;
  total_cost: number;
  generate: { calls: number; tokens: number };
  explain: { calls: number; tokens: number };
  providers: Record<string, { calls: number; tokens: number; cost: number }>;
  recent: Array<{
    time: string;
    action: string;
    provider: string;
    model: string;
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
    cost: number;
  }>;
}
