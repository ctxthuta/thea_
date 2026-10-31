'use client';
import { useEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
export default function SiteTheme({ children }) {
  const [theme, setTheme] = useState('light');
  useEffect(() => {
    try { const saved = localStorage.getItem('thea-site-theme') || localStorage.getItem('thea-landing-theme'); if (saved === 'dark' || saved === 'light') setTheme(saved); } catch {}
  }, []);
  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    try { localStorage.setItem('thea-site-theme', next); } catch {}
  }
  return <div className="site-theme" data-theme={theme}>
    {children}
    <button type="button" className="site-theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}>
      {theme === 'light' ? <Moon size={18} aria-hidden="true" /> : <Sun size={18} aria-hidden="true" />}
      <span>{theme === 'light' ? 'Dark' : 'Light'} mode</span>
    </button>
  </div>;
}
