import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getQuiz } from '../api';
import type { QuizQuestion } from '../types';

export default function ReportPage() {
  const { id } = useParams<{ id: string }>();
  const sessionId = Number(id);
  const navigate = useNavigate();

  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [score, setScore] = useState<number | null>(null);
  const [total, setTotal] = useState(0);
  const [loadError, setLoadError] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getQuiz(sessionId).then(data => {
      setQuestions(data.questions);
      setScore(data.score);
      setTotal(data.total_questions);
      setLoading(false);
    }).catch(err => {
      console.error('Failed to load report:', err);
      setLoadError(true);
      setLoading(false);
    });
  }, [sessionId]);

  const correctCount = questions.filter(q => q.is_correct).length;
  const passColor = score !== null && score >= 60 ? '#16a34a' : '#dc2626';

  if (loadError) return <div className="empty-state" style={{ color: '#dc2626' }}>加载报告失败，请返回重试</div>;
  if (loading) return <div className="empty-state">加载中...</div>;

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '20px' }}>作答报告</h1>

      <div className="card score-card">
        <div className="score-number" style={{ color: passColor }}>{score ?? 0}分</div>
        <div className="score-label">共 {total} 题 · 答对 {correctCount} 题</div>
        <div className="progress-bar mt-4" style={{ maxWidth: '300px', margin: '12px auto 0' }}>
          <div className="progress-fill" style={{ width: `${score ?? 0}%`, background: passColor }} />
        </div>
      </div>

      {questions.map((q, i) => (
        <div key={q.answer_id} className={`card report-item ${q.is_correct ? 'correct' : 'wrong'}`}>
          <div className="flex items-start justify-between mb-2">
            <div>
              <span style={{ fontWeight: 600, fontSize: '15px' }}>Q{i + 1}. {q.content}</span>
            </div>
            <span style={{ fontWeight: 700, fontSize: '14px', color: q.is_correct ? '#16a34a' : '#dc2626', flexShrink: 0, marginLeft: '12px' }}>
              {q.is_correct ? '✓ 正确' : '✗ 错误'}
            </span>
          </div>

          {Object.keys(q.options).length > 0 && (
            <div className="options-list">
              {Object.entries(q.options).map(([k, v]) => {
                // Check if user selected this option
                const userPicked = q.type === 'true_false'
                  ? q.user_answer === v
                  : q.user_answer === k;
                // Check if this is the correct answer
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
            <span style={{ color: '#6b7280' }}>你的答案: </span>
            <span style={{ fontWeight: 600, color: q.is_correct ? '#16a34a' : '#dc2626' }}>{q.user_answer || '未作答'}</span>
            {!q.is_correct && (
              <span style={{ marginLeft: '12px' }}>
                <span style={{ color: '#6b7280' }}>正确答案: </span>
                <span style={{ fontWeight: 600, color: '#16a34a' }}>{q.correct_answer}</span>
              </span>
            )}
            {q.explanation && (
              <div style={{ color: '#9ca3af', marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #e5e7eb' }}>💡 {q.explanation}</div>
            )}
          </div>
        </div>
      ))}

      <div className="flex gap-3 mt-4" style={{ justifyContent: 'center' }}>
        <button onClick={() => navigate('/quiz/start')} className="btn btn-primary btn-lg">再来一次</button>
        <button onClick={() => navigate('/')} className="btn btn-outline btn-lg">返回首页</button>
      </div>
    </div>
  );
}
