import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getHistory, deleteHistory } from '../api';
import type { QuizHistoryItem } from '../types';

export default function HistoryPage() {
  const [items, setItems] = useState<QuizHistoryItem[]>([]);
  const navigate = useNavigate();

  const load = () => getHistory().then(d => setItems(d.items));

  useEffect(() => { load(); }, []);

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (!confirm('确定删除这条作答记录吗？')) return;
    try {
      await deleteHistory(id);
      load();
    } catch {
      alert('删除失败');
    }
  };

  return (
    <div>
      <h1 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '20px' }}>作答历史</h1>

      {items.length === 0 ? (
        <div className="empty-state">还没有作答记录</div>
      ) : (
        items.map(item => {
          const passColor = item.score >= 60 ? '#16a34a' : '#dc2626';
          return (
            <div key={item.id} className="card flex items-center justify-between"
              style={{ cursor: 'pointer' }}
              onClick={() => navigate(`/quiz/${item.id}/report`)}>
              <div>
                <div style={{ fontWeight: 600, fontSize: '15px' }}>{item.total_questions} 题</div>
                <div className="text-sm text-gray mt-2">
                  {item.finished_at ? new Date(item.finished_at).toLocaleString() : ''}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '28px', fontWeight: 800, color: passColor, lineHeight: 1 }}>
                    {item.score}分
                  </div>
                  <div className="text-sm text-gray">答对 {item.correct_count}/{item.total_questions}</div>
                </div>
                <button
                  onClick={e => handleDelete(e, item.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    fontSize: '14px',
                    cursor: 'pointer',
                    padding: '4px 8px',
                    flexShrink: 0,
                  }}
                  title="删除记录"
                >
                  🗑
                </button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
