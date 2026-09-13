'use client';

import { Check, CircleSlash, KeyRound, LoaderCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Button, buttonClass } from '@/components/ui/button';
import { FormError, Input, Label } from '@/components/ui/field';

type Phase = 'enter' | 'confirm' | 'approved' | 'denied';

async function post(
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
 * Authorizes the CLI that showed this code. Approval issues that CLI its own session for this
 * account; this browser session is unchanged. Browser pages, actions, streams and downloads
 * refuse that session (see `currentSession`). Nothing is shown as approved before the server
 * confirms it.
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
  const [busy, setBusy] = useState<'look' | 'approve' | 'deny' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const trimmed = code.trim();

  async function lookUp() {
    setBusy('look');
    setError(null);
    try {
      const response = await fetch(`/api/auth/device?user_code=${encodeURIComponent(trimmed)}`, {
        headers: { accept: 'application/json' },
      });
      if (!response.ok) {
        setError(
          'That code was not found or has expired. Run assure login again and enter the new code.',
        );
        return;
      }
      setPhase('confirm');
    } catch {
      setError('The server could not be reached.');
    } finally {
      setBusy(null);
    }
  }

  async function decide(decision: 'approve' | 'deny') {
    setBusy(decision);
    setError(null);
    try {
      const result = await post(`/api/auth/device/${decision}`, { userCode: trimmed });
      if (!result.ok) {
        setError(result.message === '' ? 'The server refused the request.' : result.message);
        return;
      }
      setPhase(decision === 'approve' ? 'approved' : 'denied');
    } catch {
      setError('The server could not be reached.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={phase}
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      >
        {phase === 'approved' ? (
          <Outcome
            icon={
              <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
                <motion.path
                  d="M6 12.5l4 4 8-9"
                  fill="none"
                  stroke="var(--good)"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
                />
              </svg>
            }
            title="CLI authorized"
            description={`The CLI that showed ${trimmed} is signed in as ${email}. Return to your terminal; it continues on its own.`}
          >
            <Link href="/settings" className={buttonClass('secondary', 'md')}>
              Manage authorized CLIs
            </Link>
          </Outcome>
        ) : phase === 'denied' ? (
          <Outcome
            icon={<CircleSlash className="size-6 text-ink-2" />}
            title="Request denied"
            description="The CLI was not authorized and received nothing. You can close this tab."
          />
        ) : (
          <div>
            <div className="mb-5 grid size-11 place-items-center rounded-lg border border-line bg-raised shadow-raised">
              <KeyRound className="size-5 text-ink-2" />
            </div>
            <h1 className="text-xl font-semibold tracking-[-0.02em]">
              {phase === 'confirm' ? 'Approve this CLI?' : 'Authorize a CLI'}
            </h1>
            <p className="mt-1.5 text-sm text-ink-2">
              {phase === 'confirm'
                ? `It signs in as ${email} until the session expires or you revoke it in Settings. Only approve a code you requested yourself.`
                : 'A terminal running assure login printed a code. Enter it to continue.'}
            </p>
            <form
              className="mt-6 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault();
                if (phase === 'confirm') void decide('approve');
                else void lookUp();
              }}
            >
              {error === null ? null : <FormError>{error}</FormError>}
              {phase === 'enter' ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="user-code">Code from the terminal</Label>
                  <Input
                    id="user-code"
                    value={code}
                    onChange={(event) => {
                      setCode(event.target.value.toUpperCase());
                    }}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    required
                    className="h-12 text-center font-mono text-lg tracking-[0.28em] uppercase"
                  />
                </div>
              ) : (
                <>
                  <p className="sr-only">Code {trimmed}</p>
                  <div
                    className="flex justify-center gap-1.5 rounded-lg border border-line bg-sunken py-3"
                    aria-hidden="true"
                  >
                    {Array.from(trimmed).map((char, index) => (
                      <span
                        key={`${char}-${String(index)}`}
                        className="grid h-9 w-7 place-items-center rounded-md border border-line bg-raised font-mono text-base font-medium text-ink shadow-raised"
                      >
                        {char}
                      </span>
                    ))}
                  </div>
                  <ul className="grid gap-2 text-sm">
                    <Permission allowed>
                      Link repositories and report runs to this workspace
                    </Permission>
                    <Permission allowed>
                      Read the names and IDs of repositories in this workspace
                    </Permission>
                    <Permission allowed={false}>
                      Cannot open pages, settings or run history in this web app
                    </Permission>
                    <Permission allowed={false}>Never receives your password</Permission>
                  </ul>
                </>
              )}
              <div className="flex gap-2">
                {phase === 'confirm' ? (
                  <Button
                    disabled={busy !== null}
                    className="h-9 flex-1"
                    onClick={() => {
                      void decide('deny');
                    }}
                  >
                    {busy === 'deny' ? <LoaderCircle className="animate-spin" /> : null}
                    Deny
                  </Button>
                ) : null}
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  className="flex-1"
                  disabled={busy !== null || trimmed === ''}
                >
                  {busy === 'look' || busy === 'approve' ? (
                    <LoaderCircle className="animate-spin" />
                  ) : null}
                  {phase === 'confirm' ? 'Approve CLI' : 'Continue'}
                </Button>
              </div>
              {phase === 'confirm' ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={busy !== null}
                  className="justify-self-center"
                  onClick={() => {
                    setError(null);
                    setPhase('enter');
                  }}
                >
                  Enter a different code
                </Button>
              ) : null}
            </form>
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

function Permission({
  allowed,
  children,
}: {
  readonly allowed: boolean;
  readonly children: ReactNode;
}) {
  return (
    <li className="flex items-start gap-2.5 text-ink-2">
      {allowed ? (
        <Check className="mt-0.5 size-4 shrink-0 text-ink-3" />
      ) : (
        <CircleSlash className="mt-0.5 size-4 shrink-0 text-ink-3" />
      )}
      {children}
    </li>
  );
}

function Outcome({
  icon,
  title,
  description,
  children,
}: {
  readonly icon: ReactNode;
  readonly title: string;
  readonly description: string;
  readonly children?: ReactNode;
}) {
  return (
    <div>
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="mb-5 grid size-12 place-items-center rounded-full border border-line bg-raised shadow-raised"
      >
        {icon}
      </motion.div>
      <h1 className="text-xl font-semibold tracking-[-0.02em]">{title}</h1>
      <p className="mt-1.5 text-sm text-ink-2">{description}</p>
      {children === undefined ? null : <div className="mt-6">{children}</div>}
    </div>
  );
}
