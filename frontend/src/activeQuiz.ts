/** Shared state for active (unfinished) quiz sessions. Survives page navigation. */
const KEY = 'active_quizzes';
const MAX = 3;
export const QUIZZES_CHANGE = 'active-quizzes-change';

export interface ActiveQuiz {
  sessionId: number;
  mode: string;
  startedAt: string; // ISO
}

export function getActiveQuizzes(): ActiveQuiz[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addActiveQuiz(sessionId: number, mode: string) {
  const quizzes = getActiveQuizzes().filter(q => q.sessionId !== sessionId);
  quizzes.push({ sessionId, mode, startedAt: new Date().toISOString() });
  // Keep only the newest MAX entries
  while (quizzes.length > MAX) quizzes.shift();
  localStorage.setItem(KEY, JSON.stringify(quizzes));
  window.dispatchEvent(new Event(QUIZZES_CHANGE));
}

export function removeActiveQuiz(sessionId: number) {
  const quizzes = getActiveQuizzes().filter(q => q.sessionId !== sessionId);
  localStorage.setItem(KEY, JSON.stringify(quizzes));
  window.dispatchEvent(new Event(QUIZZES_CHANGE));
}

export function canStartNew(): boolean {
  return getActiveQuizzes().length < MAX;
}
