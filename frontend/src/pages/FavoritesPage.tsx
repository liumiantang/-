import { useEffect, useState } from 'react';
import { getFavorites, removeFavorite } from '../api';

interface FavoriteItem {
  favorite_id: number;
  question_id: number;
  type: string;
  content: string;
  options: Record<string, string>;
  answer: string;
  explanation: string;
  tags: string[];
  difficulty: number;
  bank_id: number;
}

const typeLabel = (t: string) => {
  const m: Record<string, string> = { single_choice: '单选题', multi_choice: '多选题', true_false: '判断题', fill_blank: '填空题', essay: '简答题' };
  return m[t] || t;
};

const badgeClass = (t: string) => {
  const m: Record<string, string> = { single_choice: 'badge-blue', multi_choice: 'badge-purple', true_false: 'badge-yellow', fill_blank: 'badge-green', essay: 'badge-gray' };
  return m[t] || 'badge-gray';
};

export default function FavoritesPage() {
  const [items, setItems] = useState<FavoriteItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    getFavorites().then(data => {
      setItems(data.items || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleRemove = async (questionId: number) => {
    await removeFavorite(questionId);
    load();
  };

  if (loading) return <div className="empty-state">加载中...</div>;

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h1 style={{ fontSize: '24px', fontWeight: 700 }}>⭐ 收藏夹</h1>
        <span className="text-sm text-gray">{items.length} 道题目</span>
      </div>

      {items.length === 0 ? (
        <div className="empty-state">
          <p style={{ fontSize: '18px', marginBottom: '8px' }}>⭐</p>
          <p>还没有收藏任何题目</p>
          <p className="text-sm mt-2">在练习模式中点击题目右上角的 ☆ 即可收藏</p>
        </div>
      ) : (
        items.map(item => (
          <div key={item.favorite_id} className="card" style={{ padding: '20px' }}>
            <div className="flex items-center gap-2 mb-3">
              <span className={`badge ${badgeClass(item.type)}`}>{typeLabel(item.type)}</span>
              {item.difficulty > 0 && (
                <span className="text-sm text-gray">难度: {'⭐'.repeat(item.difficulty)}</span>
              )}
              {item.tags && item.tags.length > 0 && item.tags.map(t => (
                <span key={t} className="tag">{t}</span>
              ))}
              <button
                onClick={() => handleRemove(item.question_id)}
                style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#f59e0b' }}
                title="取消收藏"
              >
                ⭐
              </button>
            </div>

            <p style={{ fontSize: '16px', fontWeight: 500, lineHeight: 1.7, marginBottom: '12px' }}>{item.content}</p>

            {item.options && Object.keys(item.options).length > 0 && (
              <div className="options-list">
                {Object.entries(item.options).map(([key, val]) => (
                  <div key={key} className={`option-item ${item.answer === key || item.answer === val ? 'correct' : ''}`}
                    style={item.answer === key || item.answer === val ? { borderLeftColor: '#16a34a', background: '#f0fdf4' } : {}}>
                    <span className="opt-label">{key}.</span>
                    <span>{val}</span>
                    {(item.answer === key || item.answer === val) && (
                      <span style={{ marginLeft: 'auto', color: '#16a34a', fontWeight: 700, fontSize: '12px' }}>✓ 答案</span>
                    )}
                  </div>
                ))}
              </div>
            )}

            {(!item.options || Object.keys(item.options).length === 0) && item.answer && (
              <div style={{ fontSize: '14px', color: '#16a34a', fontWeight: 600, marginBottom: '8px' }}>
                答案：{item.answer}
              </div>
            )}

            {item.explanation && (
              <div style={{ fontSize: '13px', color: '#6b7280', marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #e5e7eb' }}>
                💡 {item.explanation}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
