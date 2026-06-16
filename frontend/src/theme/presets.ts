// 6 preset themes — each defines a complete set of CSS variable values
export interface ThemeColors {
  '--bg-page': string;
  '--bg-card': string;
  '--bg-input': string;
  '--bg-hover': string;
  '--text-primary': string;
  '--text-secondary': string;
  '--text-muted': string;
  '--accent': string;
  '--accent-hover': string;
  '--accent-light': string;
  '--success': string;
  '--success-light': string;
  '--danger': string;
  '--danger-light': string;
  '--border': string;
  '--border-light': string;
}

export interface ThemeDefinition {
  id: string;
  name: string;
  icon: string;
  colors: ThemeColors;
  radius: number;    // 0 = sharp, 1 = normal, 2 = round
  shadow: number;    // 0 = none, 1 = light, 2 = heavy
}

const themes: ThemeDefinition[] = [
  {
    id: 'default',
    name: '默认蓝',
    icon: '🔵',
    colors: {
      '--bg-page': '#f0f2f5',
      '--bg-card': '#ffffff',
      '--bg-input': '#f9fafb',
      '--bg-hover': '#eff6ff',
      '--text-primary': '#111827',
      '--text-secondary': '#6b7280',
      '--text-muted': '#9ca3af',
      '--accent': '#2563eb',
      '--accent-hover': '#1d4ed8',
      '--accent-light': '#dbeafe',
      '--success': '#16a34a',
      '--success-light': '#f0fdf4',
      '--danger': '#dc2626',
      '--danger-light': '#fef2f2',
      '--border': '#d1d5db',
      '--border-light': '#e5e7eb',
    },
    radius: 1,
    shadow: 1,
  },
  {
    id: 'dark',
    name: '暗夜模式',
    icon: '🌙',
    colors: {
      '--bg-page': '#0f172a',
      '--bg-card': '#1e293b',
      '--bg-input': '#334155',
      '--bg-hover': '#1e3a5f',
      '--text-primary': '#f1f5f9',
      '--text-secondary': '#94a3b8',
      '--text-muted': '#64748b',
      '--accent': '#60a5fa',
      '--accent-hover': '#3b82f6',
      '--accent-light': '#1e3a5f',
      '--success': '#34d399',
      '--success-light': '#064e3b',
      '--danger': '#f87171',
      '--danger-light': '#450a0a',
      '--border': '#475569',
      '--border-light': '#334155',
    },
    radius: 1,
    shadow: 1,
  },
  {
    id: 'forest',
    name: '森系护眼',
    icon: '🌿',
    colors: {
      '--bg-page': '#f2f7f2',
      '--bg-card': '#fcfffc',
      '--bg-input': '#f7faf7',
      '--bg-hover': '#e8f5e9',
      '--text-primary': '#1a2e1a',
      '--text-secondary': '#5a7a5a',
      '--text-muted': '#8aaa8a',
      '--accent': '#2d8a4e',
      '--accent-hover': '#23703e',
      '--accent-light': '#d4edda',
      '--success': '#2d8a4e',
      '--success-light': '#d4edda',
      '--danger': '#c53030',
      '--danger-light': '#fed7d7',
      '--border': '#b7ccb7',
      '--border-light': '#d4e3d4',
    },
    radius: 1,
    shadow: 0,
  },
  {
    id: 'warm',
    name: '暖色纸张',
    icon: '📜',
    colors: {
      '--bg-page': '#f5f0e8',
      '--bg-card': '#fefcf7',
      '--bg-input': '#faf6ef',
      '--bg-hover': '#fef3e4',
      '--text-primary': '#3d3027',
      '--text-secondary': '#7a6e62',
      '--text-muted': '#a89888',
      '--accent': '#b45309',
      '--accent-hover': '#92400e',
      '--accent-light': '#fef3c7',
      '--success': '#5a8a3c',
      '--success-light': '#eaf5e0',
      '--danger': '#c53030',
      '--danger-light': '#fed7d7',
      '--border': '#d4c8b0',
      '--border-light': '#e8dcc8',
    },
    radius: 1,
    shadow: 1,
  },
  {
    id: 'cyberpunk',
    name: '赛博朋克',
    icon: '💜',
    colors: {
      '--bg-page': '#0d0221',
      '--bg-card': '#1a0a3e',
      '--bg-input': '#2d1166',
      '--bg-hover': '#2d1166',
      '--text-primary': '#e0d6ff',
      '--text-secondary': '#b8a9e8',
      '--text-muted': '#7c6baa',
      '--accent': '#c084fc',
      '--accent-hover': '#a855f7',
      '--accent-light': '#2d1166',
      '--success': '#00e5a0',
      '--success-light': '#0a3020',
      '--danger': '#ff3d6f',
      '--danger-light': '#2a0a15',
      '--border': '#4c1d95',
      '--border-light': '#3b0f7a',
    },
    radius: 2,
    shadow: 2,
  },
  {
    id: 'minimal',
    name: '极简灰白',
    icon: '⚪',
    colors: {
      '--bg-page': '#fafafa',
      '--bg-card': '#ffffff',
      '--bg-input': '#fafafa',
      '--bg-hover': '#f5f5f5',
      '--text-primary': '#171717',
      '--text-secondary': '#737373',
      '--text-muted': '#a3a3a3',
      '--accent': '#404040',
      '--accent-hover': '#262626',
      '--accent-light': '#f5f5f5',
      '--success': '#22c55e',
      '--success-light': '#f0fdf4',
      '--danger': '#ef4444',
      '--danger-light': '#fef2f2',
      '--border': '#d4d4d4',
      '--border-light': '#e5e5e5',
    },
    radius: 0,
    shadow: 0,
  },
];

export default themes;
