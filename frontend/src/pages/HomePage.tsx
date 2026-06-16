import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { listBanks, createBank, deleteBank, createWrongBook, getStats, getReviewDue } from '../api';
import type { QuestionBank, UserStats } from '../types';

export default function HomePage() {
  const [banks, setBanks] = useState<QuestionBank[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [reviewDueCount, setReviewDueCount] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [wrongBookLoading, setWrongBookLoading] = useState(false);
  const navigate = useNavigate();

  const load = () => listBanks().then(setBanks);

  useEffect(() => { load(); getStats().then(setStats); getReviewDue().then(r => setReviewDueCount(r.due_count)).catch(() => {}); }, []);

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
      {/* Review due banner */}
      {reviewDueCount > 0 && (
        <div className="card" style={{
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: 'linear-gradient(135deg, #fef3c7, #fef9c3)',
          border: '2px solid #fcd34d',
          marginBottom: '12px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '32px' }}>🧠</span>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: '#b45309' }}>
                艾宾浩斯复习提醒
              </div>
              <div style={{ fontSize: '13px', color: '#92400e', marginTop: '2px' }}>
                {reviewDueCount} 道题目等待复习，及时复习可有效对抗遗忘
              </div>
            </div>
          </div>
          <button
            onClick={() => navigate('/quiz/start?mode=review')}
            style={{
              padding: '10px 24px',
              fontSize: '14px',
              fontWeight: 700,
              borderRadius: '10px',
              border: 'none',
              background: 'linear-gradient(135deg, #f59e0b, #d97706)',
              color: '#fff',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            🚀 开始复习
          </button>
        </div>
      )}
      {reviewDueCount === 0 && stats && (
        <div className="card" style={{
          padding: '10px 24px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          background: '#f0fdf4',
          border: '1px solid #bbf7d0',
          marginBottom: '12px',
          fontSize: '13px',
          color: '#166534',
        }}>
          ✅ 暂无待复习题目，继续保持！
        </div>
      )}

      {/* Stats banner */}
      {stats && (
        <div className="card" style={{
          padding: '16px 24px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          background: stats.checked_in_today
            ? 'linear-gradient(135deg, #f0fdf4, #ecfdf5)'
            : 'linear-gradient(135deg, #fff7ed, #fffbeb)',
          border: stats.checked_in_today ? '1px solid #bbf7d0' : '1px solid #fed7aa',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ fontSize: '36px' }}>{stats.tier.icon}</div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>
                {stats.tier.stars > 0 ? stats.tier.star_tier_name : stats.tier.name}
                {stats.tier.stars > 0 && <span style={{ fontSize: '12px', color: '#f59e0b', marginLeft: '4px' }}>⭐×{stats.tier.stars}</span>}
                {' '}· Lv.{stats.xp_level}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {stats.checked_in_today
                  ? `连续 ${stats.consecutive_days} 天打卡 · 今日已打卡 ✅`
                  : '今日还未打卡，开始做题吧！'}
              </div>
            </div>
          </div>
          <Link
            to="/stats"
            style={{
              fontSize: '13px',
              fontWeight: 600,
              color: 'var(--accent)',
              textDecoration: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            查看统计 →
          </Link>
        </div>
      )}

      <div className="flex justify-between items-center mb-4" style={{ marginTop: stats ? '12px' : '0' }}>
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
