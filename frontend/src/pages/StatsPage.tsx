import { useEffect, useState } from 'react';
import { getStats } from '../api';
import type { UserStats } from '../types';

export default function StatsPage() {
  const [stats, setStats] = useState<UserStats | null>(null);

  useEffect(() => { getStats().then(setStats).catch(err => console.error('Failed to load stats:', err)); }, []);

  if (!stats) return <div className="empty-state">加载中...</div>;

  const accuracyPct = Math.round(stats.accuracy * 100);
  const xpPercent = Math.round((stats.xp_current / stats.xp_next) * 100);

  // Generate calendar for last 28 days
  const today = new Date();
  const calendarDays: { date: string; day: number; active: boolean; isToday: boolean }[] = [];
  for (let i = 27; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().slice(0, 10);
    calendarDays.push({
      date: dateStr,
      day: d.getDate(),
      active: stats.study_dates.includes(dateStr),
      isToday: i === 0,
    });
  }

  // Weekday labels
  const weekLabels = ['一', '二', '三', '四', '五', '六', '日'];
  const firstDayOfWeek = new Date(today);
  firstDayOfWeek.setDate(firstDayOfWeek.getDate() - 27);
  const startDow = (firstDayOfWeek.getDay() + 6) % 7; // Monday=0

  type CalDay = { date: string; day: number; active: boolean; isToday: boolean } | null;
  const weekRows: CalDay[][] = [];
  let currentWeek: CalDay[] = [];
  for (let i = 0; i < startDow; i++) currentWeek.push(null);
  for (const d of calendarDays) {
    currentWeek.push(d);
    if (currentWeek.length === 7) {
      weekRows.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) weekRows.push(currentWeek);

  return (
    <div>
      {/* Tier showcase */}
      <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
        <div style={{ fontSize: '64px', lineHeight: 1 }}>{stats.tier.icon}</div>
        <div style={{
          fontSize: '28px', fontWeight: 800,
          color: stats.tier.color, marginTop: '8px',
        }}>
          {stats.tier.star_tier_name || stats.tier.name}
        </div>
        {stats.tier.stars > 0 && (
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#f59e0b', marginTop: '4px' }}>
            {'⭐'.repeat(Math.min(stats.tier.stars, 10))} ×{stats.tier.stars}
          </div>
        )}
        <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '6px' }}>
          已答 {stats.total_answers} 题 · 正确率 {accuracyPct}%
        </div>

        {/* XP bar */}
        <div style={{ maxWidth: '300px', margin: '16px auto 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
            <span>Lv.{stats.xp_level}</span>
            <span>{stats.xp_current} / {stats.xp_next} XP</span>
          </div>
          <div className="progress-bar" style={{ height: '8px', borderRadius: '4px' }}>
            <div className="progress-fill" style={{
              width: `${xpPercent}%`,
              background: `linear-gradient(90deg, ${stats.tier.color}, color-mix(in srgb, ${stats.tier.color} 60%, white))`,
              borderRadius: '4px',
            }} />
          </div>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '12px' }}>
        <div className="card" style={{ textAlign: 'center', padding: '16px 10px' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--accent)' }}>{stats.total_answers}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>总答题数</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '16px 10px' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: 'var(--success)' }}>{accuracyPct}%</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>正确率</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '16px 10px' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#f59e0b' }}>🔥 {stats.max_streak}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>最高连击</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '16px 10px' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#8b5cf6' }}>{stats.total_study_days}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>学习天数</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '16px 10px' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: '#ec4899' }}>{stats.consecutive_days}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>连续打卡</div>
        </div>
        <div className="card" style={{ textAlign: 'center', padding: '16px 10px' }}>
          <div style={{ fontSize: '28px', fontWeight: 800, color: stats.checked_in_today ? '#16a34a' : '#d1d5db' }}>
            {stats.checked_in_today ? '✅' : '⭕'}
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            {stats.checked_in_today ? '今日已打卡' : '今日未打卡'}
          </div>
        </div>
      </div>

      {/* Calendar heatmap */}
      <div className="card" style={{ marginTop: '12px' }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
          📅 学习日历
        </div>

        {/* Weekday header */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
          {[...Array(7)].map((_, i) => (
            <div key={i} style={{
              width: '36px', height: '22px', fontSize: '11px',
              color: 'var(--text-muted)', textAlign: 'center', lineHeight: '22px',
            }}>
              {weekLabels[i]}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {weekRows.slice(-4).map((week, wi) => (
          <div key={wi} style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
            {week.map((d, di) => {
              if (!d) return <div key={di} style={{ width: '36px', height: '36px' }} />;
              const intensity = d.active ? 1 : 0.15;
              return (
                <div
                  key={di}
                  title={`${d.date}${d.active ? ' ✅' : ''}`}
                  style={{
                    width: '36px', height: '36px',
                    borderRadius: '4px',
                    background: d.active ? stats.tier.color : 'var(--border-light)',
                    opacity: d.active ? intensity : 1,
                    border: d.isToday ? '2px solid var(--accent)' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 600,
                    color: d.active ? '#fff' : 'var(--text-muted)',
                  }}
                >
                  {d.day}
                </div>
              );
            })}
          </div>
        ))}

        {/* Legend */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)' }}>
          <span>少</span>
          <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: 'var(--border-light)' }} />
          <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: stats.tier.color, opacity: 0.4 }} />
          <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: stats.tier.color, opacity: 0.7 }} />
          <div style={{ width: '14px', height: '14px', borderRadius: '3px', background: stats.tier.color, opacity: 1 }} />
          <span>多</span>
        </div>
      </div>

      {/* Tier progress */}
      <div className="card" style={{ marginTop: '12px', textAlign: 'center' }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '8px' }}>
          段位晋升
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { icon: '🟤', name: '青铜', threshold: 0 },
            { icon: '🥈', name: '白银', threshold: 50 },
            { icon: '🥇', name: '黄金', threshold: 200 },
            { icon: '💎', name: '钻石', threshold: 500 },
            { icon: '👑', name: '王者', threshold: 1000 },
            { icon: '⭐', name: '非凡', threshold: 1100 },
            { icon: '🌟', name: '无双', threshold: 1200 },
            { icon: '✨', name: '绝世', threshold: 1300 },
            { icon: '💫', name: '至圣', threshold: 1400 },
            { icon: '🏆', name: '荣耀', threshold: 1500 },
            { icon: '🔱', name: '传奇', threshold: 2000 },
          ].map(({ icon, name, threshold }, i) => {
            const currentName = stats.tier.star_tier_name || stats.tier.name;
            const isCurrent = currentName.includes(name) || (name === '王者' && currentName === '王者' && stats.tier.stars === 0);
            return (
              <div key={i} style={{
                padding: '8px 10px',
                borderRadius: 'var(--radius-md)',
                background: isCurrent ? stats.tier.color : 'var(--bg-input)',
                color: isCurrent ? '#fff' : 'var(--text-muted)',
                opacity: stats.total_answers >= threshold ? 1 : 0.35,
                fontSize: '11px',
                fontWeight: isCurrent ? 700 : 500,
                textAlign: 'center',
                minWidth: '52px',
                border: isCurrent ? `2px solid ${stats.tier.color}` : '1px solid var(--border-light)',
              }}>
                <div style={{ fontSize: '20px' }}>{icon}</div>
                <div>{name}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
