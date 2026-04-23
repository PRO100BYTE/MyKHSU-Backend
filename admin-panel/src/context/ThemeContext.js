import React, { createContext, useContext, useState, useEffect } from 'react';
import { ADMIN_ACCENT_COLORS, ADMIN_THEMES } from '../constants';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() =>
    localStorage.getItem('admin_theme') ?? 'dark'
  );
  const [accentColor, setAccentColor] = useState(() =>
    localStorage.getItem('admin_accent') ?? 'green'
  );
  const [uiDensity, setUiDensity] = useState(() =>
    localStorage.getItem('admin_ui_density') ?? 'comfortable'
  );

  useEffect(() => {
    const safeTheme = ADMIN_THEMES[theme] ? theme : 'dark';
    const safeAccent = ADMIN_ACCENT_COLORS[accentColor] ? accentColor : 'green';

    document.documentElement.setAttribute('data-theme', safeTheme);
    document.documentElement.setAttribute('data-accent', safeAccent);
    document.documentElement.setAttribute('data-density', uiDensity === 'compact' ? 'compact' : 'comfortable');
    localStorage.setItem('admin_theme', theme);
    localStorage.setItem('admin_accent', accentColor);
    localStorage.setItem('admin_ui_density', uiDensity === 'compact' ? 'compact' : 'comfortable');
  }, [theme, accentColor, uiDensity]);

  const toggle = () => {
    const order = ['dark', 'light', 'matrix', 'legend'];
    const currentIndex = order.indexOf(theme);
    const nextTheme = order[(currentIndex + 1) % order.length];
    setTheme(nextTheme);
    if (nextTheme === 'matrix') setAccentColor('matrix');
    if (nextTheme === 'legend') setAccentColor('legend');
  };

  const selectTheme = (nextTheme) => {
    if (!ADMIN_THEMES[nextTheme]) return;
    setTheme(nextTheme);
    if (nextTheme === 'matrix') setAccentColor('matrix');
    if (nextTheme === 'legend') setAccentColor('legend');
  };

  const selectAccentColor = (nextAccent) => {
    if (!ADMIN_ACCENT_COLORS[nextAccent]) return;
    setAccentColor(nextAccent);
  };

  const setDensity = (value) => {
    setUiDensity(value === 'compact' ? 'compact' : 'comfortable');
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        accentColor,
        uiDensity,
        toggle,
        setTheme: selectTheme,
        setAccentColor: selectAccentColor,
        setUiDensity: setDensity,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
