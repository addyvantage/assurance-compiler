import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Wordmark } from '@/components/shell';
import { currentSession } from '@/lib/session';
import '../app.css';
import { DeviceApproval } from './device-approval';

export const metadata: Metadata = { title: 'Authorize a CLI' };

export default async function DevicePage({
  searchParams,
}: {
  readonly searchParams: Promise<{ user_code?: string }>;
}) {
  const { user_code: userCode } = await searchParams;
  const session = await currentSession();
  if (session === null) {
    const next = `/device${userCode === undefined ? '' : `?user_code=${encodeURIComponent(userCode)}`}`;
    redirect(`/sign-in?next=${encodeURIComponent(next)}`);
  }
  return (
    <div className="auth-page">
      <div className="auth-card">
        <Wordmark />
        <DeviceApproval initialCode={userCode ?? ''} email={session.user.email} />
      </div>
    </div>
  );
}
