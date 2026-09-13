'use client';

import { useEffect, useState } from 'react';

type Theme = 'system' | 'light' | 'dark';

/** Stored per browser. `system` removes the override so the OS preference applies. */
export function ThemePicker() {
  const [theme, setTheme] = useState<Theme>('system');
  useEffect(() => {
    try {
      const stored = localStorage.getItem('assure-theme');
      if (stored === 'light' || stored === 'dark') setTheme(stored);
    } catch {
      // Storage unavailable: the system preference applies.
    }
  }, []);
  function choose(next: Theme) {
    setTheme(next);
    try {
      if (next === 'system') {
        localStorage.removeItem('assure-theme');
        delete document.documentElement.dataset['theme'];
      } else {
        localStorage.setItem('assure-theme', next);
        document.documentElement.dataset['theme'] = next;
      }
    } catch {
      // Ignore: the choice still applies to this page.
    }
  }
  return (
    <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className="sr-only">Appearance</legend>
      <div className="radio-row">
        {(['system', 'light', 'dark'] as const).map((option) => (
          <label key={option}>
            <input
              type="radio"
              name="theme"
              value={option}
              checked={theme === option}
              onChange={() => {
                choose(option);
              }}
            />
            {option === 'system' ? 'Match system' : option === 'light' ? 'Light' : 'Dark'}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
