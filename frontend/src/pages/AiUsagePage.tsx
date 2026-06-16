import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAiUsage, clearAiUsage } from '../api';
import type { AiUsage } from '../types';

export default function AiUsagePage() {
  const navigate = useNavigate();
  const [usage, setUsage] = useState<AiUsage | null>(null);

  const load = () => getAiUsage().then(setUsage).catch(err => console.error('Failed to load usage:', err));

  useEffect(() => { load(); }, []);

  const handleClear = async () => {
    if (!confirm('确定清空所有用量记录？')) return;
    await clearAiUsage();
    load();
  };

  if (!usage) return <div className="empty-state">加载中...</div>;

  return (
    <div>
      <button onClick={() => navigate(-1)}
        style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '14px', padding: 0, marginBottom: '16px', display: 'block' }}>
        ← 返回
      </button>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700 }}>💰 Token 用量</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>实时追踪每次 AI 调用的 token 消耗和费用</p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={load} className="btn btn-outline" style={{ fontSize: '13px' }}>🔄 刷新</button>
          <button onClick={handleClear} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '13px' }}>清空记录</button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '20px 12px' }}>
          <div style={{ fontSize: '32px', fontWeight: 800, color: 'var(--accent)' }}>{usage.total_calls}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>总调用次数</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '20px 12px' }}>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#7c3aed' }}>
            {usage.total_tokens >= 1000 ? `${(usage.total_tokens / 1000).toFixed(1)}k` : usage.total_tokens}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>总 Token</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '20px 12px' }}>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#f59e0b' }}>
            ¥{usage.total_cost.toFixed(4)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>总费用 (CNY)</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '20px 12px' }}>
          <div style={{ fontSize: '32px', fontWeight: 800, color: '#16a34a' }}>
            ¥{(usage.total_calls > 0 ? usage.total_cost / usage.total_calls : 0).toFixed(4)}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>均次费用</div>
        </div>
      </div>

      {/* Action breakdown */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        {/* Generate */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>🤖 出题</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>次数</span>
            <span style={{ fontWeight: 600 }}>{usage.generate.calls}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Token</span>
            <span style={{ fontWeight: 600 }}>{usage.generate.tokens.toLocaleString()}</span>
          </div>
        </div>
        {/* Explain */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>📝 解析</div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>次数</span>
            <span style={{ fontWeight: 600 }}>{usage.explain.calls}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px' }}>
            <span style={{ color: 'var(--text-secondary)' }}>Token</span>
            <span style={{ fontWeight: 600 }}>{usage.explain.tokens.toLocaleString()}</span>
          </div>
        </div>
        {/* Providers */}
        <div className="card" style={{ padding: '16px' }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '10px' }}>☁️ 服务商</div>
          {Object.entries(usage.providers).map(([name, p]) => (
            <div key={name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>{name}</span>
              <span style={{ fontWeight: 600 }}>
                {p.calls}次 · {p.tokens >= 1000 ? `${(p.tokens / 1000).toFixed(1)}k` : p.tokens}tk · ¥{p.cost.toFixed(4)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Recent calls */}
      <div className="card" style={{ overflow: 'auto' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px', padding: '16px 16px 0' }}>
          📋 最近调用记录
        </div>
        {usage.recent.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>暂无记录</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--border)', color: 'var(--text-secondary)', fontSize: '11px', textTransform: 'uppercase' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>时间</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>操作</th>
                <th style={{ padding: '8px 12px', textAlign: 'left' }}>模型</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>Prompt</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>完成</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>总计</th>
                <th style={{ padding: '8px 12px', textAlign: 'right' }}>费用</th>
              </tr>
            </thead>
            <tbody>
              {usage.recent.map((r, i) => {
                const actionLabel = r.action === 'generate' ? '🤖 出题' : r.action === 'explain' ? '📝 解析' : '🔍 测试';
                const d = new Date(r.time);
                const timeStr = `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
                return (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--text-muted)', fontSize: '12px', whiteSpace: 'nowrap' }}>{timeStr}</td>
                    <td style={{ padding: '8px 12px' }}>{actionLabel}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--text-secondary)', fontSize: '12px' }}>{r.provider}/{r.model}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.prompt_tokens.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.completion_tokens.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{r.total_tokens.toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', color: '#f59e0b', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>¥{r.cost.toFixed(6)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
