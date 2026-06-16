import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { ThemeDefinition } from './presets';
import themes from './presets';

// Extra customizable values beyond theme presets
export interface ThemeSettings {
  themeId: string;
  fontSize: number;      // 13-20
  radiusStyle: number;   // 0=sharp 1=normal 2=round
}

interface ThemeContextType {
  settings: ThemeSettings;
  currentTheme: ThemeDefinition;
  setTheme: (id: string) => void;
  setFontSize: (size: number) => void;
  setRadiusStyle: (style: number) => void;
  previewTheme: (id: string | null) => void;
}

const DEFAULT_SETTINGS: ThemeSettings = {
  themeId: 'default',
  fontSize: 15,
  radiusStyle: 1,
};

function loadSettings(): ThemeSettings {
  try {
    const raw = localStorage.getItem('tiku-theme');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s: ThemeSettings) {
  localStorage.setItem('tiku-theme', JSON.stringify(s));
}

function applyTheme(theme: ThemeDefinition, settings: ThemeSettings) {
  const root = document.documentElement;

  // Apply colors
  for (const [key, val] of Object.entries(theme.colors)) {
    root.style.setProperty(key, val);
  }

  // Apply radius: 0=sharp (4/6/10), 1=normal (6/10/16), 2=round (10/16/24)
  const r = settings.radiusStyle;
  root.style.setProperty('--radius-sm', ['4px', '6px', '10px'][r]);
  root.style.setProperty('--radius-md', ['6px', '10px', '16px'][r]);
  root.style.setProperty('--radius-lg', ['10px', '16px', '24px'][r]);

  // Apply shadow: 0=none, 1=light, 2=heavy
  const s = theme.shadow;
  if (s === 0) {
    root.style.setProperty('--shadow-sm', 'none');
    root.style.setProperty('--shadow-md', 'none');
    root.style.setProperty('--shadow-lg', 'none');
  } else if (s === 1) {
    root.style.setProperty('--shadow-sm', '0 1px 3px rgba(0,0,0,0.08)');
    root.style.setProperty('--shadow-md', '0 4px 12px rgba(0,0,0,0.10)');
    root.style.setProperty('--shadow-lg', '0 8px 30px rgba(0,0,0,0.12)');
  } else {
    root.style.setProperty('--shadow-sm', '0 2px 6px rgba(0,0,0,0.15)');
    root.style.setProperty('--shadow-md', '0 8px 24px rgba(0,0,0,0.20)');
    root.style.setProperty('--shadow-lg', '0 16px 48px rgba(0,0,0,0.25)');
  }

  // Apply font size
  root.style.setProperty('--font-size-sm', `${settings.fontSize - 2}px`);
  root.style.setProperty('--font-size-base', `${settings.fontSize}px`);
  root.style.setProperty('--font-size-lg', `${settings.fontSize + 2}px`);
  root.style.setProperty('--font-size-xl', `${settings.fontSize + 9}px`);
}

const ThemeContext = createContext<ThemeContextType | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<ThemeSettings>(loadSettings);

  const currentTheme = themes.find(t => t.id === settings.themeId) || themes[0];

  // Apply theme on mount + every settings change
  useEffect(() => {
    applyTheme(currentTheme, settings);
    saveSettings(settings);
  }, [currentTheme, settings]);

  const setTheme = useCallback((id: string) => {
    setSettings(prev => ({ ...prev, themeId: id }));
  }, []);

  const setFontSize = useCallback((size: number) => {
    setSettings(prev => ({ ...prev, fontSize: size }));
  }, []);

  const setRadiusStyle = useCallback((style: number) => {
    setSettings(prev => ({ ...prev, radiusStyle: style }));
  }, []);

  // Hover preview without saving
  const previewTheme = useCallback((id: string | null) => {
    if (id) {
      const theme = themes.find(t => t.id === id);
      if (theme) applyTheme(theme, settings);
    } else {
      applyTheme(currentTheme, settings);
    }
  }, [currentTheme, settings]);

  return (
    <ThemeContext.Provider value={{ settings, currentTheme, setTheme, setFontSize, setRadiusStyle, previewTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}
