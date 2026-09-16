import { useEffect, useState } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router-dom';
import { listBanks, startQuiz, getReviewDue } from '../api';
import { getActiveQuizzes, canStartNew } from '../activeQuiz';
import type { QuestionBank } from '../types';

export default function QuizStartPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const initialMode = (searchParams.get('mode') as 'practice' | 'exam' | 'review') || 'exam';
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBanks, setSelectedBanks] = useState<number[]>([]);
  const [count, setCount] = useState(10);
  const [diffMin, setDiffMin] = useState(1);
  const [diffMax, setDiffMax] = useState(5);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [excludeSeen, setExcludeSeen] = useState(false);
  const [mode, setMode] = useState<'practice' | 'exam' | 'review'>(initialMode);
  const [timeLimit, setTimeLimit] = useState(0);  // 0 = 不限时
  const [customTime, setCustomTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [reviewDueCount, setReviewDueCount] = useState(0);

  useEffect(() => { listBanks().then(setBanks).catch(err => console.error('Failed to load banks:', err)); }, []);

  // The home-page review reminder opens this page without bank selections.
  // Review mode should cover all banks by default instead of failing the
  // start request with "请至少选择一个题库".
  useEffect(() => {
    if (mode === 'review' && banks.length > 0) {
      setSelectedBanks(prev => prev.length > 0 ? prev : banks.map(bank => bank.id));
    }
  }, [mode, banks]);

  // Fetch review due count when review mode is selected
  useEffect(() => {
    if (mode === 'review') {
      getReviewDue().then(r => {
        setReviewDueCount(r.due_count);
        if (r.due_count > 0) setCount(Math.min(r.due_count, 50));  // cap at 50 per session
      }).catch(() => setReviewDueCount(0));
    }
  }, [mode]);

  const handleModeChange = (newMode: 'practice' | 'exam' | 'review') => {
    setMode(newMode);
    if (newMode !== 'exam') {
      setTimeLimit(0);
      setCustomTime('');
    }
  };

  const toggleType = (t: string) => {
    setTypeFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const activeQuizzes = getActiveQuizzes();

  const handleStart = async () => {
    const bankIds = mode === 'review' && selectedBanks.length === 0
      ? banks.map(bank => bank.id)
      : selectedBanks;
    if (bankIds.length === 0) { alert('请至少选择一个题库'); return; }
    if (count <= 0) { alert('题目数量至少为 1'); return; }
    if (diffMin > diffMax) { alert('难度范围设置错误：最小值不能大于最大值'); return; }
    if (!canStartNew()) { alert('已达到同时答题上限（3个），请先完成或提交一个'); return; }
    setLoading(true);
    try {
      const result = await startQuiz({
        bank_ids: bankIds,
        count,
        difficulty_min: diffMin,
        difficulty_max: diffMax,
        type_filter: typeFilter.length > 0 ? typeFilter : undefined,
        exclude_previous_correct: excludeSeen,
        mode,
        time_limit: timeLimit > 0 ? timeLimit : undefined,
      });
      navigate(`/quiz/${result.session_id}?mode=${mode}`);
    } catch (err: any) {
      alert('开始失败: ' + (err.response?.data?.detail || err.message));
    }
    setLoading(false);
  };

  return (
    <div>
      {/* Active sessions banner */}
      {activeQuizzes.length > 0 && (
        <div style={{
          padding: '12px 18px', borderRadius: 'var(--radius-md)', marginBottom: '18px',
          background: activeQuizzes.length >= 3 ? '#fef2f2' : '#f0f9ff',
          border: activeQuizzes.length >= 3 ? '2px solid #fecaca' : '2px solid #bae6fd',
        }}>
          <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '8px', color: activeQuizzes.length >= 3 ? '#dc2626' : '#0369a1' }}>
            {activeQuizzes.length >= 3
              ? '⚠️ 已达到同时答题上限（3个），请先完成一个再开新的'
              : `📝 你有 ${activeQuizzes.length} 场进行中的答题：`}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {activeQuizzes.map((q, i) => {
              const started = new Date(q.startedAt);
              const mins = Math.floor((Date.now() - started.getTime()) / 60000);
              const timeAgo = mins < 1 ? '刚刚' : mins < 60 ? `${mins}分钟前` : `${Math.floor(mins / 60)}小时前`;
              return (
                <Link key={q.sessionId}
                  to={`/quiz/${q.sessionId}?mode=${q.mode}`}
                  style={{
                    padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: 600,
                    textDecoration: 'none',
                    background: q.mode === 'exam' ? '#fef2f2' : '#f0fdf4',
                    color: q.mode === 'exam' ? '#dc2626' : '#16a34a',
                    border: q.mode === 'exam' ? '1px solid #fecaca' : '1px solid #bbf7d0',
                  }}>
                  {q.mode === 'exam' ? '📋 考试' : '📖 练习'} {activeQuizzes.length > 1 ? `#${i + 1}` : ''} · {timeAgo}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '24px' }}>抽题设置</h1>

      <div className="card" style={{ padding: '28px' }}>
        {/* Banks */}
        <div className="form-group">
          <label className="form-label">选择题库（可多选）</label>
          {banks.length === 0 ? (
            <p className="text-sm text-gray">还没有题库，请先创建题库并导入题目</p>
          ) : (
            <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
              {banks.map(b => (
                <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', cursor: 'pointer', fontSize: '14px' }}>
                  <input type="checkbox" checked={selectedBanks.includes(b.id)} onChange={() => {
                    setSelectedBanks(prev => prev.includes(b.id) ? prev.filter(x => x !== b.id) : [...prev, b.id]);
                  }} />
                  <span>{b.name}</span>
                  <span className="tag">{b.question_count} 题</span>
                </label>
              ))}
            </div>
          )}
        </div>

        {/* Count */}
        <div className="form-group">
          <label className="form-label">题目数量</label>
          {mode === 'review' ? (
            <div>
              <input type="number" min={1} max={reviewDueCount || 50} value={count || 1} onChange={e => setCount(Number(e.target.value) || 1)}
                className="form-input-sm" />
              <span style={{ fontSize: '12px', color: '#92400e', marginLeft: '8px' }}>到期题目: {reviewDueCount} 题</span>
            </div>
          ) : (
            <input type="number" min={1} max={200} value={count} onChange={e => setCount(Number(e.target.value))}
              className="form-input-sm" />
          )}
        </div>

        {/* Difficulty — hidden in review mode */}
        {mode !== 'review' && (
          <div className="form-group">
            <label className="form-label">难度范围</label>
            <div className="flex items-center gap-2">
              <select value={diffMin} onChange={e => setDiffMin(Number(e.target.value))} style={{ width: '80px' }}>
                {[1,2,3,4,5].map(d => <option key={d} value={d}>{d} ⭐</option>)}
              </select>
              <span>~</span>
              <select value={diffMax} onChange={e => setDiffMax(Number(e.target.value))} style={{ width: '80px' }}>
                {[1,2,3,4,5].map(d => <option key={d} value={d}>{d} ⭐</option>)}
              </select>
            </div>
          </div>
        )}

        {/* Type filter — hidden in review mode */}
        {mode !== 'review' && (
          <div className="form-group">
            <label className="form-label">题型（不选则全部）</label>
            <div className="flex flex-wrap gap-2">
              {[
                { k: 'single_choice', v: '单选题' },
                { k: 'multi_choice', v: '多选题' },
                { k: 'true_false', v: '判断题' },
                { k: 'fill_blank', v: '填空题' },
                { k: 'essay', v: '简答题' },
              ].map(({ k, v }) => (
                <button key={k} onClick={() => toggleType(k)}
                  className={typeFilter.includes(k) ? 'btn btn-primary' : 'btn btn-outline'}
                  style={{ padding: '6px 14px', fontSize: '13px' }}>
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Exclude seen — hidden in review mode */}
        {mode !== 'review' && (
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
            <input type="checkbox" checked={excludeSeen} onChange={e => setExcludeSeen(e.target.checked)} />
            排除之前已答对的题目
          </label>
        )}

        {/* Review mode: show ebbinghaus stage info */}
        {mode === 'review' && reviewDueCount === 0 && (
          <div style={{
            padding: '14px 18px', borderRadius: '10px',
            background: '#f0fdf4', border: '2px solid #bbf7d0',
            fontSize: '14px', color: '#166534', marginTop: '8px',
          }}>
            ✅ 暂无到期复习题目！学过的题目将根据艾宾浩斯遗忘曲线自动安排复习计划。
          </div>
        )}

        {/* Mode selector */}
        <div className="form-group">
          <label className="form-label">答题模式</label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div
              onClick={() => handleModeChange('exam')}
              style={{
                flex: 1, padding: '16px', borderRadius: '10px', cursor: 'pointer',
                border: mode === 'exam' ? '2px solid #2563eb' : '2px solid #e5e7eb',
                background: mode === 'exam' ? '#eff6ff' : '#fafafa',
                textAlign: 'center', transition: 'all 0.2s',
              }}>
              <div style={{ fontSize: '24px', marginBottom: '6px' }}>📝</div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>考试模式</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>交卷后统一显示答案</div>
            </div>
            <div
              onClick={() => handleModeChange('practice')}
              style={{
                flex: 1, padding: '16px', borderRadius: '10px', cursor: 'pointer',
                border: mode === 'practice' ? '2px solid #16a34a' : '2px solid #e5e7eb',
                background: mode === 'practice' ? '#f0fdf4' : '#fafafa',
                textAlign: 'center', transition: 'all 0.2s',
              }}>
              <div style={{ fontSize: '24px', marginBottom: '6px' }}>📖</div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>练习模式</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>答完每题立即显示答案</div>
            </div>
            <div
              onClick={() => handleModeChange('review')}
              style={{
                flex: 1, padding: '16px', borderRadius: '10px', cursor: 'pointer',
                border: mode === 'review' ? '2px solid #f59e0b' : '2px solid #e5e7eb',
                background: mode === 'review' ? '#fffbeb' : '#fafafa',
                textAlign: 'center', transition: 'all 0.2s',
              }}>
              <div style={{ fontSize: '24px', marginBottom: '6px' }}>🧠</div>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>艾宾浩斯复习</div>
              <div style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
                {mode === 'review' && reviewDueCount > 0
                  ? `${reviewDueCount} 道题待复习`
                  : '间隔重复对抗遗忘'}
              </div>
            </div>
          </div>
        </div>

        {/* Time limit — only for exam mode */}
        {mode === 'exam' && (
          <div className="form-group">
            <label className="form-label">⏱ 考试时间</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
              {[
                { v: 0, label: '不限时' },
                { v: 15, label: '15分钟' },
                { v: 30, label: '30分钟' },
                { v: 45, label: '45分钟' },
                { v: 60, label: '60分钟' },
                { v: 90, label: '90分钟' },
                { v: 120, label: '120分钟' },
              ].map(({ v, label }) => (
                <button
                  key={v}
                  onClick={() => { setTimeLimit(v); setCustomTime(''); }}
                  className={timeLimit === v && !customTime ? 'btn btn-primary' : 'btn btn-outline'}
                  style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px' }}
                >
                  {label}
                </button>
              ))}
              {/* Custom time input */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '4px' }}>
                <input
                  type="number"
                  min={1}
                  max={600}
                  value={customTime}
                  onChange={e => {
                    const val = e.target.value;
                    setCustomTime(val);
                    const num = parseInt(val, 10);
                    if (num > 0) setTimeLimit(num);
                    else if (!val) setTimeLimit(0);
                  }}
                  placeholder="自定义"
                  className={customTime ? 'btn btn-primary' : 'btn btn-outline'}
                  style={{
                    width: '80px',
                    padding: '8px 10px',
                    fontSize: '13px',
                    borderRadius: '8px',
                    border: customTime ? 'none' : undefined,
                    outline: 'none',
                    textAlign: 'center',
                  }}
                />
                {customTime && <span style={{ fontSize: '13px', color: '#6b7280' }}>分钟</span>}
              </div>
            </div>
          </div>
        )}

        <button onClick={handleStart} disabled={loading}
          className="btn btn-primary btn-lg w-full mt-4" style={{ width: '100%', justifyContent: 'center' }}>
          {loading ? '正在抽题...' : '开始答题'}
        </button>
      </div>
    </div>
  );
}
