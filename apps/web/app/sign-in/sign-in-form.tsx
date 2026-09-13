'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { authClient } from '@/lib/auth-client';

export function SignInForm({ next }: { readonly next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<'sign-in' | 'create'>('sign-in');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(form: FormData) {
    setError(null);
    setBusy(true);
    const email = field(form, 'email').trim();
    const password = field(form, 'password');
    const name = field(form, 'name').trim();
    try {
      const result =
        mode === 'create'
          ? await authClient.signUp.email({ email, password, name })
          : await authClient.signIn.email({ email, password });
      if (result.error) {
        setError(describe(result.error.message, result.error.status));
        return;
      }
      router.push(next);
      router.refresh();
    } catch {
      setError('The server could not be reached. Check that it is running and try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        void submit(new FormData(event.currentTarget));
      }}
      aria-describedby={error === null ? undefined : 'auth-error'}
    >
      <h1>{mode === 'create' ? 'Create your account' : 'Sign in'}</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        {mode === 'create'
          ? 'A personal workspace is created for you. Nothing is sent anywhere until you link a repository and run a check with --sync.'
          : 'Your account owns one personal workspace with its repositories and run history.'}
      </p>
      {error !== null ? (
        <p id="auth-error" className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {mode === 'create' ? (
        <div className="field">
          <label htmlFor="name">Name</label>
          <input
            id="name"
            name="name"
            className="input"
            autoComplete="name"
            required
            maxLength={80}
          />
        </div>
      ) : null}
      <div className="field">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          autoComplete="email"
          required
        />
      </div>
      <div className="field">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
          required
          minLength={12}
        />
        {mode === 'create' ? <span className="hint">At least 12 characters.</span> : null}
      </div>
      <div className="form-actions">
        <button type="submit" className="button primary" disabled={busy}>
          {busy ? 'Working' : mode === 'create' ? 'Create account' : 'Sign in'}
        </button>
        <button
          type="button"
          className="button"
          onClick={() => {
            setMode(mode === 'create' ? 'sign-in' : 'create');
            setError(null);
          }}
        >
          {mode === 'create' ? 'I have an account' : 'Create an account'}
        </button>
      </div>
    </form>
  );
}

function describe(message: string | undefined, status: number): string {
  if (status === 401 || message?.toLowerCase().includes('invalid') === true) {
    return 'Email or password is incorrect.';
  }
  if (message?.toLowerCase().includes('exist') === true) {
    return 'An account with that email already exists. Sign in instead.';
  }
  return message ?? 'Sign-in did not succeed.';
}

/** Form values are strings or files; only strings are accepted. */
function field(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}
