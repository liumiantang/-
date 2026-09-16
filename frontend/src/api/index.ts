import axios from 'axios';
import type { QuestionBank, Question, QuizSession, QuizHistoryItem, StartQuizParams, UserStats, AiConfig, AiGenerateResult, AiUsage, ReviewDue, ReviewStats, GradeEssayResponse } from '../types';

const api = axios.create({ baseURL: '/api' });

// Banks
export const listBanks = () => api.get<QuestionBank[]>('/banks').then(r => r.data);
export const getBank = (id: number) => api.get<QuestionBank>(`/banks/${id}`).then(r => r.data);
export const createBank = (name: string, description: string) => {
  const fd = new FormData();
  fd.append('name', name);
  fd.append('description', description);
  return api.post('/banks', fd).then(r => r.data);
};
export const deleteBank = (id: number) => api.delete(`/banks/${id}`).then(r => r.data);
export const importDocument = (bankId: number, file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post(`/banks/${bankId}/import`, fd).then(r => r.data);
};
export const importDocumentAi = (bankId: number, file: File) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post<{ imported: number; filename: string; method: string }>(`/banks/${bankId}/import-ai`, fd).then(r => r.data);
};

// Questions
export const getQuestions = (bankId: number, params?: Record<string, any>) =>
  api.get<{ total: number; questions: Question[] }>(`/banks/${bankId}/questions`, { params }).then(r => r.data);
export const updateQuestion = (id: number, data: Partial<Question>) =>
  api.put(`/questions/${id}`, data).then(r => r.data);
export const deleteQuestion = (id: number) => api.delete(`/questions/${id}`).then(r => r.data);

// Quiz
export const startQuiz = (params: StartQuizParams) =>
  api.post<QuizSession>('/quiz/start', params).then(r => r.data);
export const getQuiz = (id: number) =>
  api.get<QuizSession>(`/quiz/${id}`).then(r => r.data);
export const submitAnswer = (sessionId: number, answerId: number, userAnswer: string) =>
  api.post(`/quiz/${sessionId}/answer`, { answer_id: answerId, user_answer: userAnswer }).then(r => r.data);
export const finishQuiz = (sessionId: number) =>
  api.post(`/quiz/${sessionId}/finish`).then(r => r.data);
export const getHistory = (page = 1) =>
  api.get<{ total: number; items: QuizHistoryItem[] }>('/quiz/history', { params: { page, page_size: 20 } }).then(r => r.data);
export const deleteHistory = (sessionId: number) =>
  api.delete(`/quiz/${sessionId}`).then(r => r.data);

// Favorites
export const addFavorite = (questionId: number) =>
  api.post(`/questions/${questionId}/favorite`).then(r => r.data);
export const removeFavorite = (questionId: number) =>
  api.delete(`/questions/${questionId}/favorite`).then(r => r.data);
export const getFavorites = () =>
  api.get<{ items: any[] }>('/favorites').then(r => r.data);

// Wrong book
export const createWrongBook = () =>
  api.post('/banks/wrong-answer-book').then(r => r.data);

// Stats
export const getStats = () =>
  api.get<UserStats>('/stats').then(r => r.data);

// AI
export const getAiConfig = () =>
  api.get<AiConfig>('/ai/config').then(r => r.data);
export const updateAiConfig = (data: Record<string, string>) =>
  api.put('/ai/config', data).then(r => r.data);
export const testAiConnection = () =>
  api.post<{ ok: boolean; reply?: string; error?: string }>('/ai/test').then(r => r.data);
export const aiGenerate = (data: { text: string; bank_id: number; count: number; types: string[]; difficulty: number }) =>
  api.post<AiGenerateResult>('/ai/generate', data).then(r => r.data);
export const aiExplain = (questionId: number) =>
  api.post<{ explanation: string; question_id: number }>(`/ai/explain/${questionId}`).then(r => r.data);
export const getAiUsage = () =>
  api.get<AiUsage>('/ai/usage').then(r => r.data);
export const clearAiUsage = () =>
  api.delete('/ai/usage').then(r => r.data);
export const gradeEssay = (sessionId: number, answerId: number) =>
  api.post<GradeEssayResponse>('/ai/grade', { session_id: sessionId, answer_id: answerId }).then(r => r.data);

// Review (Ebbinghaus)
export const getReviewDue = (bankIds?: number[], limit?: number) => {
  const params: Record<string, string> = {};
  if (bankIds && bankIds.length > 0) params.bank_ids = bankIds.join(',');
  if (limit) params.limit = String(limit);
  return api.get<ReviewDue>('/review/due', { params }).then(r => r.data);
};
export const getReviewStats = () =>
  api.get<ReviewStats>('/review/stats').then(r => r.data);
