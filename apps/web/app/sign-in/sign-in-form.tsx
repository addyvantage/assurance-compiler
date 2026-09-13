'use client';

import { LoaderCircle } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input } from '@/components/ui/field';
import { authClient } from '@/lib/auth-client';

type Mode = 'sign-in' | 'create';

export function SignInForm({ next }: { readonly next: string }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>('sign-in');
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
    <div>
      <h1 className="text-xl font-semibold tracking-[-0.02em]">
        {mode === 'create' ? 'Create your account' : 'Sign in'}
      </h1>
      <p className="mt-1.5 text-sm text-ink-2">
        {mode === 'create'
          ? 'You get a personal workspace. Nothing leaves your machine until you link a repository and run a check with --sync.'
          : 'Your workspace keeps repositories, linked CLIs and run history.'}
      </p>
      <form
        className="mt-7 grid gap-4"
        aria-describedby={error === null ? undefined : 'auth-error'}
        onSubmit={(event) => {
          event.preventDefault();
          void submit(new FormData(event.currentTarget));
        }}
      >
        {error === null ? null : <FormError id="auth-error">{error}</FormError>}
        <AnimatePresence initial={false}>
          {mode === 'create' ? (
            <motion.div
              key="name"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="-m-1 overflow-hidden p-1"
            >
              <Field label="Name" htmlFor="name">
                <Input id="name" name="name" autoComplete="name" required maxLength={80} />
              </Field>
            </motion.div>
          ) : null}
        </AnimatePresence>
        <Field label="Email" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field
          label="Password"
          htmlFor="password"
          hint={mode === 'create' ? 'At least 12 characters.' : undefined}
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete={mode === 'create' ? 'new-password' : 'current-password'}
            required
            minLength={12}
          />
        </Field>
        <Button type="submit" variant="primary" size="lg" className="mt-1 w-full" disabled={busy}>
          {busy ? <LoaderCircle className="animate-spin" /> : null}
          {mode === 'create' ? 'Create account' : 'Sign in'}
        </Button>
      </form>
      <p className="mt-5 text-sm text-ink-2">
        {mode === 'create' ? 'Already have an account? ' : 'New to Assurance Compiler? '}
        <button
          type="button"
          className="rounded-[4px] font-medium text-accent-ink hover:underline"
          onClick={() => {
            setMode(mode === 'create' ? 'sign-in' : 'create');
            setError(null);
          }}
        >
          {mode === 'create' ? 'Sign in' : 'Create an account'}
        </button>
      </p>
    </div>
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
