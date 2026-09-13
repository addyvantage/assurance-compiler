'use client';

import { useState } from 'react';

type Phase = 'enter' | 'confirm' | 'approved' | 'denied' | 'error';

async function call(
  path: string,
  body: Record<string, string>,
): Promise<{ ok: boolean; message: string }> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let message: string;
  try {
    const parsed = JSON.parse(text) as {
      message?: string;
      error?: string;
      error_description?: string;
    };
    message = parsed.error_description ?? parsed.message ?? parsed.error ?? '';
  } catch {
    message = text;
  }
  return { ok: response.ok, message };
}

/**
 * Authorizes the CLI that showed this code. Approval creates a session for that CLI only; this
 * browser session is unchanged. Nothing is marked approved before the server confirms it.
 */
export function DeviceApproval({
  initialCode,
  email,
}: {
  readonly initialCode: string;
  readonly email: string;
}) {
  const [code, setCode] = useState(initialCode);
  const [phase, setPhase] = useState<Phase>('enter');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function lookUp() {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(
        `/api/auth/device?user_code=${encodeURIComponent(code.trim())}`,
        {
          headers: { accept: 'application/json' },
        },
      );
      if (!response.ok) {
        setError(
          'That code was not found or has expired. Run `assure login` again and enter the new code.',
        );
        return;
      }
      setPhase('confirm');
    } catch {
      setError('The server could not be reached.');
    } finally {
      setBusy(false);
    }
  }

  async function decide(decision: 'approve' | 'deny') {
    setBusy(true);
    setError(null);
    try {
      const result = await call(`/api/auth/device/${decision}`, { userCode: code.trim() });
      if (!result.ok) {
        setError(result.message === '' ? 'The server refused the request.' : result.message);
        setPhase('error');
        return;
      }
      setPhase(decision === 'approve' ? 'approved' : 'denied');
    } catch {
      setError('The server could not be reached.');
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'approved') {
    return (
      <div>
        <h1>CLI authorized</h1>
        <p className="muted">
          The CLI that showed code <span className="mono">{code.trim()}</span> is now signed in as{' '}
          {email}. You can close this tab; the terminal continues on its own. Revoke it any time in
          Settings.
        </p>
      </div>
    );
  }
  if (phase === 'denied') {
    return (
      <div>
        <h1>Request denied</h1>
        <p className="muted">The CLI was not authorized. Nothing was granted.</p>
      </div>
    );
  }
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (phase === 'confirm') void decide('approve');
        else void lookUp();
      }}
    >
      <h1>Authorize a CLI</h1>
      <p className="muted" style={{ marginBottom: 16 }}>
        A CLI running <code>assure login</code> printed a code. Approving it lets that machine
        report runs to your workspace as {email}. Only approve a code you requested yourself.
      </p>
      {error !== null ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <div className="field">
        <label htmlFor="user-code">Code shown in the terminal</label>
        <input
          id="user-code"
          className="input mono"
          value={code}
          onChange={(event) => {
            setCode(event.target.value.toUpperCase());
            setPhase('enter');
          }}
          autoComplete="off"
          spellCheck={false}
          required
        />
      </div>
      <div className="form-actions">
        {phase === 'confirm' ? (
          <>
            <button type="submit" className="button primary" disabled={busy}>
              {busy ? 'Working' : 'Approve this CLI'}
            </button>
            <button
              type="button"
              className="button"
              disabled={busy}
              onClick={() => void decide('deny')}
            >
              Deny
            </button>
          </>
        ) : (
          <button type="submit" className="button primary" disabled={busy || code.trim() === ''}>
            {busy ? 'Checking' : 'Continue'}
          </button>
        )}
      </div>
    </form>
  );
}
