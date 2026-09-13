'use client';

import { useEffect, useState } from 'react';

export type ThemeChoice = 'system' | 'light' | 'dark';

const KEY = 'assure-theme';

/** The stored choice for this browser. `system` means no override. */
export function readTheme(): ThemeChoice {
  try {
    const stored = localStorage.getItem(KEY);
    return stored === 'light' || stored === 'dark' ? stored : 'system';
  } catch {
    return 'system';
  }
}

export function applyTheme(choice: ThemeChoice): void {
  const root = document.documentElement;
  if (choice === 'system') delete root.dataset['theme'];
  else root.dataset['theme'] = choice;
  try {
    if (choice === 'system') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
  } catch {
    // Storage unavailable: the choice still applies to this page.
  }
  window.dispatchEvent(new Event('assure:theme'));
}

/** The current choice, kept in step across every control that changes it. */
export function useThemeChoice(): ThemeChoice {
  const [theme, setTheme] = useState<ThemeChoice>('system');
  useEffect(() => {
    const sync = () => {
      setTheme(readTheme());
    };
    sync();
    window.addEventListener('assure:theme', sync);
    return () => {
      window.removeEventListener('assure:theme', sync);
    };
  }, []);
  return theme;
}
