import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getQuiz, gradeEssay } from '../api';
import type { QuizQuestion } from '../types';

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const sessionId = Number(id);
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [gradingId, setGradingId] = useState<number | null>(null);

  useEffect(() => {
    getQuiz(sessionId).then(data => {
      setQuestions(data.questions);
      setScore(data.score);
      setTotal(data.total_questions);
      setPendingCount(data.pending_count ?? data.questions.filter(q =>
        q.type === 'essay' && q.user_answer.trim() && q.ai_score == null
      ).length);
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load report:', err);
      setLoadError(true);
      setLoading(false);
    });
  }, [sessionId]);

  // Count correct: non-essay with is_correct=true, or essay with ai_score >= 60
  const correctCount = questions.filter(q =>
    q.type === 'essay' ? (q.ai_score !== null && q.ai_score >= 60) : q.is_correct
  ).length;
  const passColor = pendingCount > 0
    ? '#d97706'
    : score !== null && score >= 60 ? '#16a34a' : '#dc2626';

  const handleGradeEssay = async (answerId: number) => {
    setGradingId(answerId);
    try {
      const result = await gradeEssay(sessionId, answerId);
      setQuestions(prev => {
        const updated = prev.map(q => {
          if (q.answer_id === answerId) {
            return { ...q, ai_score: result.score, ai_feedback: result.feedback };
          }
          return q;
        });
        // Recalculate weighted score after grading
        const objCorrect = updated.filter(q => q.type !== 'essay' && q.is_correct).length;
        const aiSum = updated.reduce((s, q) => s + (q.type === 'essay' && q.ai_score !== null ? q.ai_score : 0), 0);
        const newScore = total > 0 ? Math.round((objCorrect * 100 + aiSum) / total * 10) / 10 : 0;
        setScore(newScore);
        setPendingCount(count => Math.max(0, count - 1));
        return updated;
      });
    } catch (err: any) {
      alert('AI 评分失败: ' + (err.response?.data?.detail || err.message));
    }
    setGradingId(null);
  };

  if (loadError) return <div className="empty-state" style={{ color: '#dc2626' }}>加载报告失败，请返回重试</div>;
  if (loading) return <div className="empty-state">加载中...</div>;

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '20px' }}>作答报告</h1>

      <div className="card score-card">
        <div className="score-number" style={{ color: passColor }}>
          {pendingCount > 0 ? '待评分' : `${score ?? 0}分`}
        </div>
        <div className="score-label">
          共 {total} 题 · 答对 {correctCount} 题
          {pendingCount > 0 && ` · ${pendingCount} 题待 AI 评分`}
        </div>
        <div className="progress-bar mt-4" style={{ maxWidth: '300px', margin: '12px auto 0' }}>
          <div className="progress-fill" style={{ width: `${score ?? 0}%`, background: passColor }} />
        </div>
      </div>

      {questions.map((q, i) => {
        const isEssay = q.type === 'essay';
        const hasAiScore = isEssay && q.ai_score !== null;
        const aiScoreColor = hasAiScore
          ? q.ai_score! >= 60 ? '#16a34a' : q.ai_score! >= 40 ? '#d97706' : '#dc2626'
          : '#6b7280';
        const cardClass = isEssay
          ? (hasAiScore ? (q.ai_score! >= 60 ? 'correct' : 'wrong') : '')
          : (q.is_correct ? 'correct' : 'wrong');

        return (
        <div key={q.answer_id} className={`card report-item ${cardClass}`}>
          <div className="flex items-start justify-between mb-2">
            <div style={{ flex: 1 }}>
              <span style={{ fontWeight: 600, fontSize: '15px' }}>Q{i + 1}. {q.content}</span>
              <span className={`badge ${isEssay ? 'badge-gray' : ''}`} style={{ marginLeft: '8px', fontSize: '11px' }}>
                {isEssay ? '简答题' : ''}
              </span>
            </div>
            {isEssay ? (
              hasAiScore ? (
                <span style={{ fontWeight: 700, fontSize: '14px', color: aiScoreColor, flexShrink: 0, marginLeft: '12px' }}>
                  🤖 {q.ai_score}分
                </span>
              ) : (
                <button
                  onClick={() => handleGradeEssay(q.answer_id)}
                  disabled={gradingId === q.answer_id}
                  style={{
                    background: 'linear-gradient(135deg, #f59e0b, #d97706)', border: 'none',
                    borderRadius: '8px', padding: '6px 14px', fontSize: '13px',
                    fontWeight: 700, color: '#fff', cursor: 'pointer', flexShrink: 0, marginLeft: '12px',
                    opacity: gradingId === q.answer_id ? 0.6 : 1,
                  }}
                >
                  {gradingId === q.answer_id ? '⏳ 评分中...' : '🤖 AI 评分'}
                </button>
              )
            ) : (
              <span style={{ fontWeight: 700, fontSize: '14px', color: q.is_correct ? '#16a34a' : '#dc2626', flexShrink: 0, marginLeft: '12px' }}>
                {q.is_correct ? '✓ 正确' : '✗ 错误'}
              </span>
            )}
          </div>

          {!isEssay && Object.keys(q.options).length > 0 && (
            <div className="options-list">
              {Object.entries(q.options).map(([k, v]) => {
                const userPicked = q.type === 'true_false'
                  ? q.user_answer === v
                  : q.user_answer === k;
                const isCorrectOpt = q.type === 'true_false'
                  ? q.correct_answer === v
                  : (q.correct_answer.includes(k) && q.type === 'multi_choice') || q.correct_answer === k;
                return (
                <div key={k} className="option-item"
                  style={{
                    borderLeftColor: userPicked && !q.is_correct ? '#dc2626'
                      : isCorrectOpt ? '#16a34a'
                      : userPicked ? '#16a34a'
                      : '#e5e7eb',
                    background: userPicked && !q.is_correct ? '#fef2f2'
                      : isCorrectOpt ? '#f0fdf4'
                      : userPicked ? '#f0fdf4'
                      : '#f9fafb',
                  }}>
                  <span className="opt-label">{k}.</span>
                  <span>{v}</span>
                  {userPicked && <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 600, color: q.is_correct ? '#16a34a' : '#dc2626' }}>你的答案</span>}
                  {!userPicked && isCorrectOpt && <span style={{ marginLeft: 'auto', fontSize: '12px', fontWeight: 600, color: '#16a34a' }}>✓ 正确答案</span>}
                </div>
              )})}
            </div>
          )}

          <div className="mt-2 text-sm">
            {isEssay ? (
              <>
                <div style={{ marginBottom: '8px' }}>
                  <div style={{ color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>📝 你的答案：</div>
                  <div style={{
                    padding: '10px 14px', borderRadius: '8px', background: '#f9fafb',
                    border: '1px solid #e5e7eb', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                  }}>{q.user_answer || '未作答'}</div>
                </div>
                {q.correct_answer && (
                  <div style={{ marginBottom: '8px' }}>
                    <div style={{ color: '#6b7280', marginBottom: '4px', fontWeight: 600 }}>📋 参考答案：</div>
                    <div style={{
                      padding: '10px 14px', borderRadius: '8px', background: '#f0fdf4',
                      border: '1px solid #bbf7d0', lineHeight: 1.6, whiteSpace: 'pre-wrap',
                    }}>{q.correct_answer}</div>
                  </div>
                )}
                {hasAiScore && (
                  <div style={{
                    padding: '12px 16px', borderRadius: '10px',
                    background: q.ai_score! >= 60 ? '#f0fdf4' : q.ai_score! >= 40 ? '#fffbeb' : '#fef2f2',
                    border: `2px solid ${aiScoreColor}`,
                  }}>
                    <div style={{ fontSize: '15px', fontWeight: 700, marginBottom: '6px', color: aiScoreColor }}>
                      🤖 AI 评分：{q.ai_score} 分
                    </div>
                    {q.ai_feedback && (
                      <div style={{ fontSize: '13px', color: '#6b7280', lineHeight: 1.6 }}>
                        {q.ai_feedback}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                <span style={{ color: '#6b7280' }}>你的答案: </span>
                <span style={{ fontWeight: 600, color: q.is_correct ? '#16a34a' : '#dc2626' }}>{q.user_answer || '未作答'}</span>
                {!q.is_correct && (
                  <span style={{ marginLeft: '12px' }}>
                    <span style={{ color: '#6b7280' }}>正确答案: </span>
                    <span style={{ fontWeight: 600, color: '#16a34a' }}>{q.correct_answer}</span>
                  </span>
                )}
              </>
            )}
            {q.explanation && (
              <div style={{ color: '#9ca3af', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #e5e7eb' }}>💡 {q.explanation}</div>
            )}
          </div>
        </div>
      )})}

      <div className="flex gap-3 mt-4" style={{ justifyContent: 'center' }}>
        <button onClick={() => navigate('/quiz/start')} className="btn btn-primary btn-lg">再来一次</button>
        <button onClick={() => navigate('/')} className="btn btn-outline btn-lg">返回首页</button>
      </div>
    </div>
  );
}
