import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Wordmark } from '@/components/app/mark';
import { safeNext } from '@/lib/safe-next';
import { currentSession } from '@/lib/session';
import { ExamplePanel } from './example-panel';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Sign in' };

export default async function SignInPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = safeNext(next);
  if ((await currentSession()) !== null) redirect(destination);
  return (
    <div className="grid min-h-dvh bg-canvas lg:grid-cols-[minmax(440px,1fr)_minmax(0,1.2fr)]">
      <div className="flex flex-col px-6 py-6 sm:px-10">
        <Wordmark />
        <div className="flex flex-1 items-center justify-center py-12">
          <div className="w-full max-w-[360px] animate-[rise_480ms_var(--ease-out-quint)_both]">
            <SignInForm next={destination} />
          </div>
        </div>
        <p className="max-w-[48ch] text-xs text-ink-3">
          Local checks never need an account. Sign in to keep run history and follow runs as they
          happen.
        </p>
      </div>
      <div className="hidden border-l border-line bg-panel lg:flex lg:items-center lg:justify-center lg:px-12 lg:py-10">
        <ExamplePanel />
      </div>
    </div>
  );
}
