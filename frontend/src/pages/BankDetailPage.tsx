import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getBank, getQuestions, importDocument, importDocumentAi, deleteQuestion, updateQuestion, aiExplain } from '../api';
import type { QuestionBank, Question } from '../types';

export default function BankDetailPage() {
  const { id } = useParams<{ id: string }>();
  const bankId = Number(id);
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const aiFileRef = useRef<HTMLInputElement>(null);

  const [bank, setBank] = useState<QuestionBank | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [importing, setImporting] = useState(false);
  const [aiImporting, setAiImporting] = useState(false);
  const [typeFilter, setTypeFilter] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAnswer, setEditAnswer] = useState('');
  const [saving, setSaving] = useState(false);
  const [explainingId, setExplainingId] = useState<number | null>(null);

  const load = () => {
    getBank(bankId).then(setBank);
    getQuestions(bankId, { type: typeFilter || undefined, page_size: 200 }).then(d => {
      setQuestions(d.questions);
      setTotal(d.total);
    });
  };

  useEffect(() => { load(); }, [bankId, typeFilter]);

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const result = await importDocument(bankId, file);
      alert(`成功导入 ${result.imported} 道题目`);
      load();
    } catch (err: any) {
      alert('导入失败: ' + (err.response?.data?.detail || err.message));
    }
    setImporting(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  const handleAiImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAiImporting(true);
    try {
      const result = await importDocumentAi(bankId, file);
      alert(`AI 智能导入成功：${result.imported} 道题目`);
      load();
    } catch (err: any) {
      alert('AI 导入失败: ' + (err.response?.data?.detail || err.message));
    }
    setAiImporting(false);
    if (aiFileRef.current) aiFileRef.current.value = '';
  };

  const handleDelete = async (qId: number) => {
    if (!confirm('确定删除该题？')) return;
    await deleteQuestion(qId);
    load();
  };

  const startEdit = (q: Question) => {
    setEditingId(q.id);
    setEditAnswer(q.answer || '');
  };

  const saveEdit = async (q: Question) => {
    setSaving(true);
    await updateQuestion(q.id, { answer: editAnswer });
    setSaving(false);
    setEditingId(null);
    load();
  };

  const handleAiExplain = async (q: Question) => {
    setExplainingId(q.id);
    try {
      const res = await aiExplain(q.id);
      // Update local state with new explanation
      setQuestions(prev => prev.map(p => p.id === q.id ? { ...p, explanation: res.explanation } : p));
    } catch (err: any) {
      alert('AI 解析失败: ' + (err.response?.data?.detail || err.message));
    }
    setExplainingId(null);
  };

  const typeLabel = (t: string) => {
    const m: Record<string, string> = { single_choice: '单选', multi_choice: '多选', true_false: '判断', fill_blank: '填空', essay: '简答' };
    return m[t] || t;
  };

  const badgeClass = (t: string) => {
    const m: Record<string, string> = { single_choice: 'badge-blue', multi_choice: 'badge-purple', true_false: 'badge-yellow', fill_blank: 'badge-green', essay: 'badge-gray' };
    return m[t] || 'badge-gray';
  };

  const diffStars = (d: number) => '⭐'.repeat(d);

  const answerHint = (q: Question) => {
    if (q.type === 'single_choice') return '输入选项字母，如: A';
    if (q.type === 'multi_choice') return '输入选项字母(无空格)，如: ABCD';
    if (q.type === 'true_false') return '正确 或 错误';
    if (q.type === 'fill_blank') return '输入正确答案';
    return '输入参考答案';
  };

  return (
    <div>
      <button onClick={() => navigate('/')} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '14px', padding: 0, marginBottom: '16px', display: 'block' }}>
        ← 返回题库列表
      </button>

      {bank && (
        <div className="mb-4">
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>{bank.name}</h1>
          <p className="text-sm text-gray">{bank.description} · 共 {total} 题</p>
        </div>
      )}

      <div className="filters-row">
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          <option value="">全部题型</option>
          <option value="single_choice">单选题</option>
          <option value="multi_choice">多选题</option>
          <option value="true_false">判断题</option>
          <option value="fill_blank">填空题</option>
          <option value="essay">简答题</option>
        </select>

        <button onClick={() => fileRef.current?.click()} disabled={importing}
          className="btn btn-success">
          {importing ? '导入中...' : '📥 普通导入'}
        </button>
        <input ref={fileRef} type="file" accept=".md,.txt,.xlsx,.xls,.docx,.pdf" onChange={handleImport} style={{ display: 'none' }} />
        <button onClick={() => aiFileRef.current?.click()} disabled={aiImporting}
          className="btn" style={{
            background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', color: '#fff',
            border: 'none', fontWeight: 600
          }}>
          {aiImporting ? 'AI 解析中...' : '🤖 AI 智能导入'}
        </button>
        <input ref={aiFileRef} type="file" accept=".md,.txt,.xlsx,.xls,.docx,.pdf" onChange={handleAiImport} style={{ display: 'none' }} />
        <span className="text-sm text-gray">支持 .md / .txt / .xlsx / .docx / .pdf</span>
      </div>

      {questions.length === 0 ? (
        <div className="empty-state">暂无题目，点击"导入文档"来添加题目</div>
      ) : (
        <div>
          {questions.map(q => (
            <div key={q.id} className="card">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span className={`badge ${badgeClass(q.type)}`}>{typeLabel(q.type)}</span>
                <span style={{ fontSize: '12px' }}>{diffStars(q.difficulty)}</span>
                {q.tags.map(t => <span key={t} className="tag">{t}</span>)}
                <div style={{ flex: 1 }} />
                <button onClick={() => handleDelete(q.id)}
                  style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px' }}>
                  删除
                </button>
              </div>

              <p style={{ fontSize: '15px', fontWeight: 500, lineHeight: 1.6, marginBottom: '10px' }}>
                {q.content}
              </p>

              {Object.keys(q.options).length > 0 && (
                <div className="options-list">
                  {Object.entries(q.options).map(([k, v]) => (
                    <div key={k} className="option-item">
                      <span className="opt-label">{k}.</span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
              )}

              <div style={{ marginTop: '10px', fontSize: '13px' }}>
                {editingId === q.id ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontWeight: 600, color: '#374151' }}>答案:</span>
                    <input
                      value={editAnswer}
                      onChange={e => setEditAnswer(e.target.value)}
                      placeholder={answerHint(q)}
                      style={{ padding: '4px 10px', fontSize: '14px', width: '160px' }}
                      autoFocus
                      onKeyDown={e => { if (e.key === 'Enter') saveEdit(q); if (e.key === 'Escape') setEditingId(null); }}
                    />
                    <button onClick={() => saveEdit(q)} disabled={saving} className="btn btn-primary" style={{ padding: '4px 12px', fontSize: '12px' }}>
                      保存
                    </button>
                    <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: '#6b7280', fontSize: '12px' }}>
                      取消
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ color: q.answer ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                      答案: {q.answer || '(未设置)'}
                    </span>
                    <button onClick={() => startEdit(q)}
                      style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '12px', textDecoration: 'underline' }}>
                      编辑
                    </button>
                    {q.explanation && <span style={{ color: '#9ca3af', marginLeft: '8px', flex: 1 }}>解析: {q.explanation}</span>}
                    <button
                      onClick={() => handleAiExplain(q)}
                      disabled={explainingId === q.id}
                      style={{
                        background: 'none', border: 'none', color: '#8b5cf6', fontSize: '12px',
                        cursor: 'pointer', whiteSpace: 'nowrap',
                      }}
                    >
                      {explainingId === q.id ? '⏳ 解析中...' : '🤖 AI 解析'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
