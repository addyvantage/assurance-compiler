import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Wordmark } from '@/components/app/mark';
import { currentSession } from '@/lib/session';
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
    <div className="flex min-h-dvh flex-col bg-canvas px-6 py-6 sm:px-10">
      <Wordmark />
      <div className="flex flex-1 items-center justify-center py-10">
        <div className="w-full max-w-[400px] animate-[rise_480ms_var(--ease-out-quint)_both]">
          <DeviceApproval initialCode={userCode ?? ''} email={session.user.email} />
        </div>
      </div>
    </div>
  );
}
