import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Wordmark } from '@/components/shell';
import { currentSession } from '@/lib/session';
import '../app.css';
import { SignInForm } from './sign-in-form';

export const metadata: Metadata = { title: 'Sign in' };

/** Only same-origin paths may be used as a post-sign-in destination. */
function safeNext(value: string | undefined): string {
  return value !== undefined &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\')
    ? value
    : '/repositories';
}

export default async function SignInPage({
  searchParams,
}: {
  readonly searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const destination = safeNext(next);
  if ((await currentSession()) !== null) redirect(destination);
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Wordmark />
        <SignInForm next={destination} />
      </div>
    </div>
  );
}
