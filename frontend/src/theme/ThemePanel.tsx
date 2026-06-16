import { useState } from 'react';
import { useTheme } from './ThemeContext';
import themes from './presets';

export default function ThemePanel() {
  const { settings, setTheme, setFontSize, setRadiusStyle, previewTheme } = useTheme();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Floating trigger button */}
      <button
        onClick={() => setOpen(!open)}
        title="主题设置"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: 'none',
          background: 'var(--accent)',
          color: '#fff',
          fontSize: '22px',
          cursor: 'pointer',
          zIndex: 1000,
          boxShadow: 'var(--shadow-md)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.2s',
        }}
        onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; }}
        onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; }}
      >
        🎨
      </button>

      {/* Backdrop */}
      {open && (
        <div
          onClick={() => setOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1001,
            background: 'rgba(0,0,0,0.3)',
          }}
        />
      )}

      {/* Panel */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: open ? 0 : '-380px',
        width: '360px',
        height: '100vh',
        zIndex: 1002,
        background: 'var(--bg-card)',
        borderLeft: '1px solid var(--border-light)',
        boxShadow: 'var(--shadow-lg)',
        transition: 'right 0.3s ease',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          padding: '20px',
          borderBottom: '1px solid var(--border-light)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>🎨 主题设置</h2>
          <button
            onClick={() => setOpen(false)}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '20px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '4px 8px',
            }}
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {/* Theme cards */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
              配色方案
            </div>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '10px',
            }}>
              {themes.map(t => {
                const isActive = settings.themeId === t.id;
                const c = t.colors;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTheme(t.id)}
                    onMouseEnter={() => { if (!isActive) previewTheme(t.id); }}
                    onMouseLeave={() => { if (!isActive) previewTheme(null); }}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '12px 8px',
                      borderRadius: 'var(--radius-md)',
                      border: isActive ? '2px solid var(--accent)' : '2px solid var(--border-light)',
                      background: isActive ? 'var(--accent-light)' : 'var(--bg-card)',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    {/* Mini color preview — 3 dots */}
                    <div style={{ display: 'flex', gap: '4px' }}>
                      <span style={{
                        width: '16px', height: '16px', borderRadius: '50%',
                        background: c['--accent'],
                      }} />
                      <span style={{
                        width: '16px', height: '16px', borderRadius: '50%',
                        background: c['--bg-page'],
                        border: '1px solid var(--border-light)',
                      }} />
                      <span style={{
                        width: '16px', height: '16px', borderRadius: '50%',
                        background: c['--text-primary'],
                      }} />
                    </div>
                    <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                      {t.icon} {t.name}
                    </span>
                    {isActive && (
                      <span style={{ fontSize: '11px', color: 'var(--accent)', fontWeight: 600 }}>✓ 当前</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Font size */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
              字体大小: <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{settings.fontSize}px</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>A</span>
              <input
                type="range"
                min={13}
                max={20}
                value={settings.fontSize}
                onChange={e => setFontSize(Number(e.target.value))}
                style={{
                  flex: 1,
                  height: '6px',
                  accentColor: 'var(--accent)',
                  cursor: 'pointer',
                }}
              />
              <span style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-muted)' }}>A</span>
            </div>
            <div style={{
              fontSize: `${settings.fontSize}px`,
              color: 'var(--text-secondary)',
              marginTop: '8px',
              padding: '8px 12px',
              background: 'var(--bg-input)',
              borderRadius: 'var(--radius-sm)',
              textAlign: 'center',
            }}>
              预览文字效果
            </div>
          </div>

          {/* Radius toggle */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
              圆角风格
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {[
                { v: 0, label: '▣ 直角', desc: '干练' },
                { v: 1, label: '◈ 微圆', desc: '舒适' },
                { v: 2, label: '● 大圆', desc: '柔和' },
              ].map(({ v, label, desc }) => {
                const active = settings.radiusStyle === v;
                return (
                  <button
                    key={v}
                    onClick={() => setRadiusStyle(v)}
                    style={{
                      flex: 1,
                      padding: '10px 8px',
                      borderRadius: 'var(--radius-md)',
                      border: active ? '2px solid var(--accent)' : '2px solid var(--border-light)',
                      background: active ? 'var(--accent-light)' : 'var(--bg-card)',
                      cursor: 'pointer',
                      textAlign: 'center',
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)' }}>{label}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{desc}</div>
                  </button>
                );
              })}
            </div>
            {/* Radius preview */}
            <div style={{
              display: 'flex', gap: '8px', marginTop: '10px',
            }}>
              {[4, 10, 20].map((_r, i) => (
                <div key={i} style={{
                  width: '40px', height: '40px',
                  background: 'var(--accent-light)',
                  border: '2px solid var(--accent)',
                  borderRadius: [['4px','6px','10px'],['6px','10px','16px'],['10px','16px','24px']][settings.radiusStyle][i],
                  transition: 'border-radius 0.2s',
                }} />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border-light)',
          textAlign: 'center',
        }}>
          <button
            onClick={() => {
              setTheme('default');
              setFontSize(15);
              setRadiusStyle(1);
            }}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-sm)',
              padding: '8px 20px',
              fontSize: '13px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            恢复默认设置
          </button>
        </div>
      </div>
    </>
  );
}
