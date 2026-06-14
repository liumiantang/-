import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { getQuiz, submitAnswer, finishQuiz, addFavorite, removeFavorite, getFavorites } from '../api';
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
  const mode: 'practice' | 'exam' = (searchParams.get('mode') as 'practice' | 'exam') || 'exam';

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

  useEffect(() => {
    getQuiz(sessionId).then(data => {
      if (data.is_finished) {
        navigate(`/quiz/${sessionId}/report`);
        return;
      }
      setQuestions(data.questions);
      setTotal(data.total_questions);
    });
  }, [sessionId]);

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
  }, [currentIdx]);

  const q = questions[currentIdx];
  if (!q) return <div className="empty-state">加载中...</div>;

  const handleAnswer = async (value: string) => {
    setSubmitting(true);
    try {
      const result = await submitAnswer(sessionId, q.answer_id, value);
      setAnswers(prev => ({ ...prev, [q.answer_id]: value }));

      if (mode === 'practice') {
        // Show feedback immediately
        setFeedback({
          is_correct: result.is_correct,
          correct_answer: result.correct_answer,
          explanation: result.explanation,
        });
        if (!result.is_correct) {
          setWrongIds(prev => new Set(prev).add(q.answer_id));
        }

        if (q.type === 'single_choice' || q.type === 'true_false') {
          // Auto-advance after delay to let user read feedback
          setTimeout(() => {
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

  const handleFinish = async () => {
    if (!confirm('确定交卷吗？')) return;
    await finishQuiz(sessionId);
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
          <span style={{ fontWeight: 600, color: mode === 'practice' ? '#16a34a' : '#2563eb' }}>
            {mode === 'practice' ? '📖 练习模式' : '📝 考试模式'}
          </span>
        </div>
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
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-4">
        <button onClick={() => setCurrentIdx(Math.max(0, currentIdx - 1))} disabled={currentIdx === 0}
          className="btn btn-outline">
          ← 上一题
        </button>
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
