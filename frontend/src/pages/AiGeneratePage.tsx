import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listBanks, aiGenerate, getAiConfig } from '../api';
import type { QuestionBank } from '../types';

const TYPE_OPTIONS = [
  { value: 'single_choice', label: '单选题' },
  { value: 'multi_choice', label: '多选题' },
  { value: 'true_false', label: '判断题' },
  { value: 'fill_blank', label: '填空题' },
];

export default function AiGeneratePage() {
  const navigate = useNavigate();
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [hasKey, setHasKey] = useState(false);
  const [text, setText] = useState('');
  const [bankId, setBankId] = useState<number | null>(null);
  const [count, setCount] = useState(5);
  const [types, setTypes] = useState<string[]>(['single_choice']);
  const [difficulty, setDifficulty] = useState(3);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    listBanks().then(b => { setBanks(b); if (b.length > 0) setBankId(b[0].id); });
    getAiConfig().then(c => setHasKey(c.has_key));
  }, []);

  const toggleType = (t: string) => {
    setTypes(prev => prev.includes(t) ? prev.filter(v => v !== t) : [...prev, t]);
  };

  const handleGenerate = async () => {
    if (!text.trim()) { setError('请输入文本内容'); return; }
    if (!bankId) { setError('请选择题库'); return; }
    if (types.length === 0) { setError('请选择至少一种题型'); return; }
    setError('');
    setLoading(true);
    setResult(null);
    try {
      const res = await aiGenerate({ text: text.trim(), bank_id: bankId, count, types, difficulty });
      setResult(res);
    } catch (err: any) {
      setError(err.response?.data?.detail || '生成失败，请检查 AI 配置');
    }
    setLoading(false);
  };

  const typeBadge = (t: string) => {
    const m: Record<string, { label: string; color: string }> = {
      single_choice: { label: '单选', color: '#2563eb' },
      multi_choice: { label: '多选', color: '#7c3aed' },
      true_false: { label: '判断', color: '#d97706' },
      fill_blank: { label: '填空', color: '#16a34a' },
    };
    const v = m[t] || { label: t, color: '#6b7280' };
    return <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: 'var(--radius-sm)', background: v.color, color: '#fff', fontWeight: 600 }}>{v.label}</span>;
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>🤖 AI 智能出题</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
            粘贴知识点文本，AI 自动生成题目并导入题库
          </p>
        </div>
        <Link to="/ai/settings" style={{ fontSize: '13px', color: 'var(--accent)' }}>
          ⚙️ AI 设置
        </Link>
      </div>

      {!hasKey && (
        <div style={{
          padding: '12px 16px', borderRadius: 'var(--radius-md)', marginBottom: '16px',
          background: '#fff7ed', border: '1px solid #fed7aa', fontSize: '13px', color: '#c2410c',
        }}>
          ⚠️ 尚未配置 API Key，请先前往 <Link to="/ai/settings" style={{ fontWeight: 600, color: '#c2410c' }}>AI 设置</Link> 配置
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '16px' }}>
        {/* Left: text input */}
        <div className="card" style={{ padding: '16px' }}>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="在此粘贴需要出题的知识点文本...

例如：
人工智能是计算机科学的一个分支，它企图了解智能的实质，并生产出一种新的能以人类智能相似的方式做出反应的智能机器。该领域的研究包括机器人、语言识别、图像识别、自然语言处理和专家系统等。"
            style={{
              width: '100%', height: '320px', padding: '12px', fontSize: '14px',
              border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
              background: 'var(--bg-input)', color: 'var(--text-primary)',
              resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.7,
            }}
          />
        </div>

        {/* Right: settings */}
        <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>目标题库</label>
            <select
              value={bankId ?? ''}
              onChange={e => setBankId(Number(e.target.value))}
              style={{ width: '100%', padding: '8px 10px', fontSize: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
            >
              {banks.map(b => <option key={b.id} value={b.id}>{b.name} ({b.question_count}题)</option>)}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>出题数量</label>
            <input type="number" min={1} max={20} value={count}
              onChange={e => setCount(Math.max(1, Math.min(20, Number(e.target.value))))}
              style={{ width: '100%', padding: '8px 10px', fontSize: '14px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)', background: 'var(--bg-input)', color: 'var(--text-primary)' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>题型</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {TYPE_OPTIONS.map(t => (
                <button key={t.value}
                  onClick={() => toggleType(t.value)}
                  style={{
                    padding: '5px 12px', fontSize: '12px', borderRadius: 'var(--radius-sm)',
                    border: types.includes(t.value) ? `2px solid var(--accent)` : '1px solid var(--border)',
                    background: types.includes(t.value) ? 'var(--accent-light)' : 'var(--bg-input)',
                    color: types.includes(t.value) ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: types.includes(t.value) ? 600 : 400,
                    cursor: 'pointer',
                  }}
                >{t.label}</button>
              ))}
            </div>
          </div>

          <div>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
              难度：{'⭐'.repeat(difficulty)}
            </label>
            <input type="range" min={1} max={5} value={difficulty}
              onChange={e => setDifficulty(Number(e.target.value))}
              style={{ width: '100%' }}
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={loading || !hasKey}
            className="btn btn-primary"
            style={{ padding: '10px', fontSize: '15px', fontWeight: 600, marginTop: 'auto' }}
          >
            {loading ? '⏳ AI 生成中...' : '🤖 生成题目'}
          </button>

          {error && (
            <div style={{ padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '13px' }}>
              {error}
            </div>
          )}
        </div>
      </div>

      {/* Result preview */}
      {result && (
        <div style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>
              ✅ 成功生成 {result.imported} 道题目
            </h2>
            <button
              onClick={() => navigate(`/banks/${bankId}`)}
              className="btn btn-outline"
              style={{ fontSize: '13px' }}
            >
              前往题库查看 →
            </button>
          </div>
          {result.questions.map((q: any, i: number) => (
            <div key={i} className="card" style={{ padding: '14px 16px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                {typeBadge(q.type)}
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>难度 {'⭐'.repeat(q.difficulty || 3)}</span>
                {q.tags?.map((t: string) => <span key={t} className="tag">{t}</span>)}
              </div>
              <p style={{ fontSize: '14px', fontWeight: 500, lineHeight: 1.6, marginBottom: '8px' }}>{q.content}</p>
              {q.options && Object.keys(q.options).length > 0 && (
                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                  {Object.entries(q.options).map(([k, v]) => (
                    <span key={k} style={{ marginRight: '16px' }}>{k}. {v as string}</span>
                  ))}
                </div>
              )}
              <div style={{ fontSize: '12px', display: 'flex', gap: '16px' }}>
                <span style={{ color: '#16a34a', fontWeight: 600 }}>答案: {q.answer}</span>
                {q.explanation && <span style={{ color: '#9ca3af' }}>解析: {q.explanation}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
