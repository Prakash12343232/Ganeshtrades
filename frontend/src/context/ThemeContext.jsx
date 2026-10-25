import { createContext, useContext, useEffect, useMemo, useState } from 'react';

export const THEMES = {
  fresh: {
    name: 'Fresh Green',
    description: 'A calm, garden fresh market feel.',
    colors: ['#176B45', '#B7E4B0', '#F7FAF5', '#FFFFFF'],
    mode: 'light',
  },
  royal: {
    name: 'Royal Purple',
    description: 'A polished, soft purple storefront.',
    colors: ['#6D28D9', '#C4B5FD', '#F8F7FF', '#FFFFFF'],
    mode: 'light',
  },
  midnight: {
    name: 'Midnight Neon',
    description: 'Deep night surfaces with vivid highlights.',
    colors: ['#8B5CF6', '#34D399', '#0B1020', '#151C30'],
    mode: 'dark',
  },
  warm: {
    name: 'Warm Market',
    description: 'A welcoming, sunlit neighborhood market.',
    colors: ['#C65D32', '#F2D5A7', '#FFF8EC', '#FFFFFF'],
    mode: 'light',
  },
};

const ThemeContext = createContext(null);
const THEME_KEY = 'ganesh-theme';

function readSavedTheme() {
  try {
    const saved = localStorage.getItem(THEME_KEY) || localStorage.getItem('theme');
    if (saved && THEMES[saved]) return saved;
    if (saved === 'light') return 'fresh';
    if (saved === 'dark') return 'midnight';
  } catch {
    // Storage can be unavailable in private browsing; the default still works.
  }
  return 'midnight';
}

function applyTheme(theme) {
  const root = document.documentElement;
  root.dataset.theme = theme;
  root.classList.remove('light', 'dark', 'theme-fresh', 'theme-royal', 'theme-midnight', 'theme-warm');
  root.classList.add(THEMES[theme].mode, `theme-${theme}`);
  root.style.colorScheme = THEMES[theme].mode;
  const themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.content = THEMES[theme].colors[2];
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readSavedTheme);

  useEffect(() => {
    applyTheme(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
      localStorage.setItem('theme', THEMES[theme].mode);
    } catch {
      // Keep the active theme for this session even if persistence is blocked.
    }
  }, [theme]);

  const setTheme = (nextTheme) => {
    if (THEMES[nextTheme]) setThemeState(nextTheme);
  };

  const value = useMemo(() => ({
    theme,
    themes: THEMES,
    setTheme,
    toggleTheme: () => setThemeState((current) => current === 'midnight' ? 'fresh' : 'midnight'),
  }), [theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
