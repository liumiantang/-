import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listBanks, startQuiz } from '../api';
import type { QuestionBank } from '../types';

export default function QuizStartPage() {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [selectedBanks, setSelectedBanks] = useState<number[]>([]);
  const [count, setCount] = useState(10);
  const [diffMin, setDiffMin] = useState(1);
  const [diffMax, setDiffMax] = useState(5);
  const [typeFilter, setTypeFilter] = useState<string[]>([]);
  const [excludeSeen, setExcludeSeen] = useState(false);
  const [mode, setMode] = useState<'practice' | 'exam'>('exam');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => { listBanks().then(setBanks); }, []);

  const toggleType = (t: string) => {
    setTypeFilter(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  };

  const handleStart = async () => {
    if (selectedBanks.length === 0) { alert('请至少选择一个题库'); return; }
    setLoading(true);
    try {
      const result = await startQuiz({
        bank_ids: selectedBanks,
        count,
        difficulty_min: diffMin,
        difficulty_max: diffMax,
        type_filter: typeFilter.length > 0 ? typeFilter : undefined,
        exclude_previous_correct: excludeSeen,
        mode,
      });
      navigate(`/quiz/${result.session_id}?mode=${mode}`);
    } catch (err: any) {
      alert('开始失败: ' + (err.response?.data?.detail || err.message));
    }
    setLoading(false);
  };

  return (
    <div>
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
          <input type="number" min={1} max={200} value={count} onChange={e => setCount(Number(e.target.value))}
            className="form-input-sm" />
        </div>

        {/* Difficulty */}
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

        {/* Type filter */}
        <div className="form-group">
          <label className="form-label">题型（不选则全部）</label>
          <div className="flex flex-wrap gap-2">
            {[
              { k: 'single_choice', v: '单选题' },
              { k: 'multi_choice', v: '多选题' },
              { k: 'true_false', v: '判断题' },
              { k: 'fill_blank', v: '填空题' },
            ].map(({ k, v }) => (
              <button key={k} onClick={() => toggleType(k)}
                className={typeFilter.includes(k) ? 'btn btn-primary' : 'btn btn-outline'}
                style={{ padding: '6px 14px', fontSize: '13px' }}>
                {v}
              </button>
            ))}
          </div>
        </div>

        {/* Exclude seen */}
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px' }}>
          <input type="checkbox" checked={excludeSeen} onChange={e => setExcludeSeen(e.target.checked)} />
          排除之前已答对的题目
        </label>

        {/* Mode selector */}
        <div className="form-group">
          <label className="form-label">答题模式</label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <div
              onClick={() => setMode('exam')}
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
              onClick={() => setMode('practice')}
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
          </div>
        </div>

        <button onClick={handleStart} disabled={loading}
          className="btn btn-primary btn-lg w-full mt-4" style={{ width: '100%', justifyContent: 'center' }}>
          {loading ? '正在抽题...' : '开始答题'}
        </button>
      </div>
    </div>
  );
}
