import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getQuiz, submitAnswer, finishQuiz, addFavorite, removeFavorite, getFavorites, aiExplain, deleteHistory } from '../api';
import { addActiveQuiz, removeActiveQuiz } from '../activeQuiz';
import type { QuizQuestion } from '../types';

interface FeedbackData {
  is_correct: boolean | null;
  correct_answer: string;
  explanation: string;
}

export default function QuizPage() {
  const { id } = useParams<{ id: string }>();
  const sessionId = Number(id);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const mode: 'practice' | 'exam' | 'review' = (searchParams.get('mode') as 'practice' | 'exam' | 'review') || 'exam';

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [total, setTotal] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<FeedbackData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Local draft state for fill_blank/essay and multi_choice
  const [draftAnswer, setDraftAnswer] = useState('');
  const [wrongIds, setWrongIds] = useState<Set<number>>(new Set());
  const [favorites, setFavorites] = useState<Set<number>>(new Set());
  const [favoriting, setFavoriting] = useState(false);
  // AI explanation in practice mode
  const [aiExplainingId, setAiExplainingId] = useState<number | null>(null);
  const [aiExplanations, setAiExplanations] = useState<Record<number, string>>({});
  const aiTriggeredRef = useRef(false); // block auto-advance when AI explain is open
  // Countdown timer state
  const [timeLimit, setTimeLimit] = useState<number | null>(null);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState<number>(0);
  const [timerExpired, setTimerExpired] = useState(false);
  const [quizReady, setQuizReady] = useState(false);
  // Streak tracking (practice mode)
  const [streak, setStreak] = useState(0);
  const [streakAnim, setStreakAnim] = useState<string | null>(null);
  // Review mode: track per-question review info
  const [reviewInfos, setReviewInfos] = useState<Record<number, { stage: number; next_review_at: string | null }>>({});

  useEffect(() => {
    getQuiz(sessionId).then(data => {
      if (data.is_finished) {
        removeActiveQuiz(sessionId);
        navigate(`/quiz/${sessionId}/report`);
        return;
      }
      setQuestions(data.questions);
      setTotal(data.total_questions);

      // Restore previous answers from backend (survives page navigation)
      const restoredAnswers: Record<number, string> = {};
      const restoredWrong = new Set<number>();
      data.questions.forEach(q => {
        if (q.user_answer) {
          restoredAnswers[q.answer_id] = q.user_answer;
          if (q.is_correct === false) restoredWrong.add(q.answer_id);
        }
      });
      setAnswers(restoredAnswers);
      setWrongIds(restoredWrong);

      // Jump to first unanswered question; if all done, stay on last
      const firstUnanswered = data.questions.findIndex(q => !q.user_answer);
      if (firstUnanswered >= 0) {
        setCurrentIdx(firstUnanswered);
      } else {
        setCurrentIdx(data.questions.length - 1);
      }

      // Recompute practice-mode streak from consecutive correct answers
      if (mode === 'practice') {
        let cnt = 0;
        for (let i = data.questions.length - 1; i >= 0; i--) {
          if (data.questions[i].is_correct === true) cnt++;
          else break;
        }
        setStreak(cnt);
      }

      // Timer data
      if (data.time_limit && data.started_at) {
        setTimeLimit(data.time_limit);
        setStartedAt(data.started_at);
      }
      // Persist active session so user can navigate back
      addActiveQuiz(sessionId, mode);
      setQuizReady(true);
    });
  }, [sessionId]);

  // Countdown effect
  useEffect(() => {
    if (!timeLimit || !startedAt || mode !== 'exam' || timerExpired) return;

    const startedMs = new Date(startedAt).getTime();
    const endMs = startedMs + timeLimit * 60 * 1000;

    const tick = () => {
      const remaining = Math.max(0, Math.floor((endMs - Date.now()) / 1000));
      setRemainingSeconds(remaining);
      if (remaining <= 0) {
        setTimerExpired(true);
      }
    };

    tick(); // Immediate first update
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [timeLimit, startedAt, mode, timerExpired]);

  // Auto-finish when timer expires (only when quiz is fully loaded)
  useEffect(() => {
    if (!timerExpired || !quizReady || total === 0) return;
    finishQuiz(sessionId).then(() => {
      removeActiveQuiz(sessionId);
      navigate(`/quiz/${sessionId}/report`);
    });
  }, [timerExpired, quizReady, total, sessionId, navigate]);

  // Load favorites to know which questions are already starred
  useEffect(() => {
    getFavorites().then(data => {
      const ids = new Set(data.items.map((item: { question_id: number }) => item.question_id));
      setFavorites(ids);
    }).catch(() => {});
  }, [sessionId]);

  // Reset feedback and draft when switching questions
  useEffect(() => {
    setFeedback(null);
    setDraftAnswer('');
    aiTriggeredRef.current = false;
  }, [currentIdx]);

  const q = questions[currentIdx];
  if (!q) return <div className="empty-state">加载中...</div>;

  const handleAnswer = async (value: string) => {
    setSubmitting(true);
    try {
      const result = await submitAnswer(sessionId, q.answer_id, value);
      setAnswers(prev => ({ ...prev, [q.answer_id]: value }));

      if (mode === 'practice' || mode === 'review') {
        // Show feedback immediately
        setFeedback({
          is_correct: result.is_correct,
          correct_answer: result.correct_answer,
          explanation: result.explanation,
        });
        // Track review info if available
        if (result.review) {
          setReviewInfos(prev => ({ ...prev, [q.answer_id]: result.review }));
        }
        // Streak tracking
        if (result.is_correct) {
          const newStreak = streak + 1;
          setStreak(newStreak);
          // Trigger milestone animation
          if (newStreak === 2) setStreakAnim('二连击破！');
          else if (newStreak === 3) setStreakAnim('三连决胜！');
          else if (newStreak === 4) setStreakAnim('四连超凡！');
          else if (newStreak === 5) setStreakAnim('五连绝世！');
          else if (newStreak === 10) setStreakAnim('超神！🔥');
          // Auto-clear animation
          if ([2, 3, 4, 5, 10].includes(newStreak)) {
            setTimeout(() => setStreakAnim(null), 2000);
          }
        } else {
          setStreak(0);
        }
        if (!result.is_correct) {
          setWrongIds(prev => new Set(prev).add(q.answer_id));
        }

        if (result.is_correct && (q.type === 'single_choice' || q.type === 'true_false')) {
          // Auto-advance only on correct answers, let user read feedback
          setTimeout(() => {
            if (aiTriggeredRef.current) return;
            setFeedback(null);
            if (currentIdx < questions.length - 1) setCurrentIdx(currentIdx + 1);
          }, 2000);
        }
      } else {
        // Exam mode: no feedback, just advance
        if (q.type === 'single_choice' || q.type === 'true_false') {
          setTimeout(() => {
            if (currentIdx < questions.length - 1) setCurrentIdx(currentIdx + 1);
          }, 400);
        }
      }
    } catch {}
    setSubmitting(false);
  };

  const handleAiExplain = async () => {
    aiTriggeredRef.current = true; // block auto-advance
    setAiExplainingId(q.answer_id);
    try {
      const res = await aiExplain(q.question_id);
      setAiExplanations(prev => ({ ...prev, [q.answer_id]: res.explanation }));
    } catch (err: any) {
      alert('AI 解析失败: ' + (err.response?.data?.detail || err.message));
    }
    setAiExplainingId(null);
  };

  const handleToggleFavorite = async () => {
    if (favoriting) return;
    setFavoriting(true);
    try {
      if (favorites.has(q.question_id)) {
        await removeFavorite(q.question_id);
        setFavorites(prev => { const next = new Set(prev); next.delete(q.question_id); return next; });
      } else {
        await addFavorite(q.question_id);
        setFavorites(prev => new Set(prev).add(q.question_id));
      }
    } catch {}
    setFavoriting(false);
  };

  const handleAbandon = async () => {
    if (!confirm('确定放弃本次答题吗？本次记录将不会保存。')) return;
    await deleteHistory(sessionId);
    removeActiveQuiz(sessionId);
    navigate('/quiz/start');
  };

  const handleFinish = async () => {
    if (!confirm('确定交卷吗？')) return;
    await finishQuiz(sessionId);
    removeActiveQuiz(sessionId);
    navigate(`/quiz/${sessionId}/report`);
  };

  const userAnswer = answers[q.answer_id] || '';

  const typeLabel = (t: string) => {
    const m: Record<string, string> = { single_choice: '单选题', multi_choice: '多选题', true_false: '判断题', fill_blank: '填空题', essay: '简答题' };
    return m[t] || t;
  };

  const badgeClass = (t: string) => {
    const m: Record<string, string> = { single_choice: 'badge-blue', multi_choice: 'badge-purple', true_false: 'badge-yellow', fill_blank: 'badge-green', essay: 'badge-gray' };
    return m[t] || 'badge-gray';
  };

  return (
    <div>
      {/* Progress */}
      <div className="mb-4">
        <div className="flex justify-between text-sm text-gray mb-2">
          <span>进度: {currentIdx + 1} / {total}</span>
          <span style={{ fontWeight: 600, color: mode === 'practice' ? '#16a34a' : mode === 'review' ? '#f59e0b' : '#2563eb' }}>
            {mode === 'practice' ? '📖 练习模式' : mode === 'review' ? '🧠 艾宾浩斯复习' : '📝 考试模式'}
            {mode === 'practice' && streak >= 2 && (
              <span style={{
                marginLeft: '8px', fontSize: '12px', fontWeight: 700,
                color: streak >= 10 ? '#f59e0b' : streak >= 5 ? '#ec4899' : '#8b5cf6',
                animation: 'fadeIn 0.3s ease',
              }}>
                🔥 {streak}连击
              </span>
            )}
          </span>
        </div>
        {/* Countdown timer — exam mode only */}
        {mode === 'exam' && timeLimit && remainingSeconds > 0 && (
          <div style={{
            textAlign: 'center',
            padding: '8px 16px',
            marginBottom: '10px',
            borderRadius: '8px',
            fontSize: '18px',
            fontWeight: 700,
            fontFamily: 'monospace',
            background: remainingSeconds <= 300 ? '#fef2f2' : '#f0f9ff',
            border: remainingSeconds <= 300 ? '2px solid #dc2626' : '2px solid #bae6fd',
            color: remainingSeconds <= 300 ? '#dc2626' : '#0369a1',
            animation: remainingSeconds <= 60 ? 'pulse 1s infinite' : 'none',
          }}>
            ⏱ 剩余 {Math.floor(remainingSeconds / 60)}:{String(remainingSeconds % 60).padStart(2, '0')}
            {remainingSeconds <= 300 && remainingSeconds > 60 && (
              <span style={{ fontSize: '12px', marginLeft: '8px' }}>即将结束!</span>
            )}
            {remainingSeconds <= 60 && (
              <span style={{ fontSize: '12px', marginLeft: '8px' }}>即将自动交卷!</span>
            )}
          </div>
        )}
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${((currentIdx + 1) / total) * 100}%` }} />
        </div>
        <div className="q-dots">
          {questions.map((_, i) => (
            <button key={i} onClick={() => setCurrentIdx(i)}
              className={`q-dot ${i === currentIdx ? 'active' : ''} ${wrongIds.has(questions[i].answer_id) ? 'wrong' : answers[questions[i].answer_id] ? 'answered' : ''}`}>
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {/* Streak animation overlay */}
      {streakAnim && (
        <div style={{
          position: 'fixed',
          top: 0, left: 0, right: 0, bottom: 0,
          zIndex: 999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}>
          <div style={{
            fontSize: streakAnim.length > 4 ? '42px' : '56px',
            fontWeight: 900,
            color: '#f59e0b',
            textShadow: '0 4px 20px rgba(245,158,11,0.4)',
            animation: 'fadeIn 0.3s ease, pulse 0.5s infinite',
          }}>
            {streakAnim}
          </div>
        </div>
      )}

      {/* Question */}
      <div className="card" style={{ padding: '28px' }}>
        <div className="flex items-center gap-2 mb-4">
          <span className="badge" style={{ fontSize: '13px', fontWeight: 700, color: '#2563eb', background: '#dbeafe', padding: '4px 10px', borderRadius: '6px' }}>
            Q{currentIdx + 1}
          </span>
          <span className={`badge ${badgeClass(q.type)}`}>{typeLabel(q.type)}</span>
          {mode === 'practice' && (
            <button
              onClick={handleToggleFavorite}
              disabled={favoriting}
              style={{
                marginLeft: 'auto',
                background: 'none',
                border: 'none',
                fontSize: '22px',
                cursor: favoriting ? 'default' : 'pointer',
                opacity: favoriting ? 0.5 : 1,
                lineHeight: 1,
                padding: '2px 4px',
              }}
              title={favorites.has(q.question_id) ? '取消收藏' : '加入收藏'}
            >
              {favorites.has(q.question_id) ? '⭐' : '☆'}
            </button>
          )}
        </div>

        <p style={{ fontSize: '17px', fontWeight: 500, lineHeight: 1.7, marginBottom: '24px' }}>{q.content}</p>

        {/* Single choice */}
        {q.type === 'single_choice' && (
          <div>
            {Object.entries(q.options).map(([key, val]) => (
              <button key={key} onClick={() => !feedback && handleAnswer(key)}
                disabled={!!feedback || submitting}
                className={`option-btn ${userAnswer === key ? 'selected' : ''}`}>
                <span className="option-letter">{key}</span>
                <span>{val}</span>
              </button>
            ))}
          </div>
        )}

        {/* Multi choice */}
        {q.type === 'multi_choice' && (
          <div>
            {Object.entries(q.options).map(([key, val]) => {
              const currentSelection = draftAnswer || userAnswer;
              const checked = currentSelection.includes(key);
              return (
                <button key={key} onClick={() => {
                  if (feedback) return; // Locked after submission in practice mode
                  const cur = currentSelection.split('').filter(Boolean);
                  const next = cur.includes(key) ? cur.filter(x => x !== key) : [...cur, key];
                  setDraftAnswer(next.sort().join(''));
                }}
                  disabled={!!feedback}
                  className={`option-btn ${checked ? 'selected' : ''}`}>
                  <span className="option-letter">{key}</span>
                  <span>{val}</span>
                  {checked && <span style={{ marginLeft: 'auto', color: '#2563eb', fontSize: '18px' }}>✓</span>}
                </button>
              );
            })}
            {!feedback && (
              <button onClick={() => handleAnswer(draftAnswer || userAnswer)}
                disabled={submitting || !(draftAnswer || userAnswer)}
                className="btn btn-primary" style={{ marginTop: '12px', width: '100%' }}>
                {submitting ? '提交中...' : '确认答案'}
              </button>
            )}
          </div>
        )}

        {/* True/False */}
        {q.type === 'true_false' && (
          <div style={{ display: 'flex', gap: '16px' }}>
            {['正确', '错误'].map(v => (
              <button key={v} onClick={() => !feedback && handleAnswer(v)}
                disabled={!!feedback || submitting}
                className={`option-btn ${userAnswer === v ? 'selected' : ''}`}
                style={{ flex: 1, justifyContent: 'center', fontSize: '18px' }}>
                {v === '正确' ? '✅ 正确' : '❌ 错误'}
              </button>
            ))}
          </div>
        )}

        {/* Fill blank / Essay */}
        {(q.type === 'fill_blank' || q.type === 'essay') && (
          <div>
            <textarea
              value={feedback ? userAnswer : (draftAnswer || userAnswer)}
              onChange={e => { if (!feedback) setDraftAnswer(e.target.value); }}
              readOnly={!!feedback}
              style={{ width: '100%', minHeight: '120px', fontSize: '15px', padding: '14px' }}
              placeholder="请输入答案..." />
            {!feedback && (
              <button onClick={() => handleAnswer(draftAnswer || userAnswer)}
                disabled={submitting || !(draftAnswer || userAnswer)}
                className="btn btn-primary" style={{ marginTop: '12px', width: '100%' }}>
                {submitting ? '提交中...' : '确认答案'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Practice mode feedback */}
      {feedback && (
        <div style={{
          marginTop: '16px', padding: '16px 20px', borderRadius: '10px',
          border: feedback.is_correct ? '2px solid #16a34a' : '2px solid #dc2626',
          background: feedback.is_correct ? '#f0fdf4' : '#fef2f2',
          animation: 'fadeIn 0.3s ease',
        }}>
          <div style={{ fontSize: '16px', fontWeight: 700, marginBottom: '8px', color: feedback.is_correct ? '#16a34a' : '#dc2626' }}>
            {feedback.is_correct === null ? '📝 已提交' : feedback.is_correct ? '✓ 回答正确！' : '✗ 回答错误'}
          </div>
          {!feedback.is_correct && feedback.correct_answer && (
            <div style={{ fontSize: '14px', marginBottom: '4px' }}>
              <span style={{ color: '#6b7280' }}>正确答案：</span>
              <span style={{ fontWeight: 600, color: '#16a34a' }}>{feedback.correct_answer}</span>
            </div>
          )}
          {feedback.is_correct && feedback.correct_answer && (
            <div style={{ fontSize: '14px', marginBottom: '4px' }}>
              <span style={{ color: '#6b7280' }}>答案：</span>
              <span style={{ fontWeight: 600, color: '#16a34a' }}>{feedback.correct_answer}</span>
            </div>
          )}
          {feedback.explanation && (
            <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '6px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
              💡 {feedback.explanation}
            </div>
          )}
          {/* Review stage info */}
          {reviewInfos[q.answer_id] && (
            <div style={{
              marginTop: '10px', paddingTop: '10px', borderTop: '2px dashed #fcd34d',
              fontSize: '13px', color: '#92400e', lineHeight: 1.7,
            }}>
              <div style={{ fontWeight: 700, marginBottom: '4px' }}>
                🧠 艾宾浩斯复习进度
              </div>
              <div>
                当前阶段：<b>第 {reviewInfos[q.answer_id].stage} 阶段</b>
                {reviewInfos[q.answer_id].stage >= 6
                  ? ' · ✅ 已完全掌握！'
                  : ` · 下次复习：${reviewInfos[q.answer_id].next_review_at
                    ? new Date(reviewInfos[q.answer_id].next_review_at!).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', weekday: 'short' })
                    : '稍后'}`
                }
              </div>
              <div style={{ fontSize: '11px', color: '#a16207', marginTop: '4px' }}>
                📐 艾宾浩斯间隔：1天 → 2天 → 4天 → 7天 → 15天 → 30天
              </div>
            </div>
          )}
          {/* AI Explain button */}
          <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '2px dashed #e5e7eb' }}>
            {aiExplanations[q.answer_id] ? (
              <div style={{
                fontSize: '13px', color: '#5b21b6', lineHeight: 1.7,
                background: '#faf5ff', padding: '10px 14px', borderRadius: '8px',
                border: '1px solid #e9d5ff',
              }}>
                <div style={{ fontWeight: 700, marginBottom: '4px', color: '#7c3aed' }}>🤖 AI 深度解析</div>
                {aiExplanations[q.answer_id]}
              </div>
            ) : (
              <button
                onClick={handleAiExplain}
                disabled={aiExplainingId === q.answer_id}
                style={{
                  background: 'none', border: '2px dashed #c4b5fd', borderRadius: 'var(--radius-md)',
                  padding: '8px 16px', fontSize: '13px', fontWeight: 600, color: '#7c3aed',
                  cursor: 'pointer', width: '100%',
                }}
              >
                {aiExplainingId === q.answer_id ? '⏳ AI 正在解析...' : '🤖 AI 智能解析'}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-4">
        <div className="flex gap-2">
          <button onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))} disabled={currentIdx === 0}
            className="btn btn-outline">
            ← 上一题
          </button>
          {mode === 'practice' && (
            <button onClick={handleAbandon}
              style={{
                background: 'none', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)',
                padding: '6px 14px', fontSize: '13px', color: 'var(--text-muted)',
                cursor: 'pointer',
              }}>
              🗑 放弃答题
            </button>
          )}
        </div>
        <div className="flex gap-2">
          {currentIdx < questions.length - 1 ? (
            <button onClick={() => setCurrentIdx(currentIdx + 1)} className="btn btn-primary btn-lg">
              下一题 →
            </button>
          ) : (
            <button onClick={handleFinish} className="btn btn-danger btn-lg">
              交卷
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
