import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listBanks, createBank, deleteBank, createWrongBook } from '../api';
import type { QuestionBank } from '../types';

export default function HomePage() {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [wrongBookLoading, setWrongBookLoading] = useState(false);
  const navigate = useNavigate();

  const load = () => listBanks().then(setBanks);

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    await createBank(name, desc);
    setName(''); setDesc(''); setShowCreate(false);
    load();
  };

  const handleWrongBook = async () => {
    setWrongBookLoading(true);
    try {
      const result = await createWrongBook();
      if (result.bank_id) {
        alert(result.message || `错题本已更新，包含 ${result.count} 道错题`);
        load();
      } else {
        alert(result.message || '暂无错题可汇总');
      }
    } catch {
      alert('生成错题本失败');
    }
    setWrongBookLoading(false);
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>题库列表</h1>
        <div className="flex gap-2">
          <button onClick={handleWrongBook} disabled={wrongBookLoading}
            className="btn btn-outline" style={{ fontSize: '13px' }}>
            {wrongBookLoading ? '生成中...' : '📋 生成错题本'}
          </button>
          <button onClick={() => setShowCreate(true)} className="btn btn-primary">+ 新建题库</button>
        </div>
      </div>

      {showCreate && (
        <div className="card mb-4">
          <div className="form-group">
            <label className="form-label">题库名称</label>
            <input className="form-input" placeholder="输入题库名称" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">描述（可选）</label>
            <input className="form-input" placeholder="输入描述" value={desc} onChange={e => setDesc(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button onClick={handleCreate} className="btn btn-primary">创建</button>
            <button onClick={() => setShowCreate(false)} className="btn btn-outline">取消</button>
          </div>
        </div>
      )}

      {banks.length === 0 ? (
        <div className="empty-state">还没有题库，点击上方按钮创建一个</div>
      ) : (
        banks.map(b => (
          <div key={b.id} className="card flex items-center justify-between" style={{ cursor: 'pointer' }}
            onClick={() => navigate(`/banks/${b.id}`)}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 600 }}>{b.name}</h3>
              <p className="text-sm text-gray mt-2">{b.description || '无描述'} · {b.question_count} 题</p>
            </div>
            <div className="flex gap-2">
              <button onClick={e => { e.stopPropagation(); navigate(`/banks/${b.id}`); }}
                className="btn btn-outline" style={{ padding: '6px 12px', fontSize: '12px' }}>查看</button>
              <button onClick={e => { e.stopPropagation(); if (confirm('确定删除？')) { deleteBank(b.id).then(load); } }}
                style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '12px' }}>删除</button>
            </div>
          </div>
        ))
      )}

      <div className="mt-4">
        <Link to="/history" style={{ color: '#2563eb', fontSize: '14px' }}>查看作答历史 →</Link>
      </div>
    </div>
  );
}
