'use client';

import type { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { authClient } from '@/lib/auth-client';

/** Signs out, and says so when it did not work instead of leaving the page unchanged. */
export async function signOut(router: ReturnType<typeof useRouter>): Promise<void> {
  try {
    const result = await authClient.signOut();
    if (result.error) throw new Error(result.error.message);
    router.push('/sign-in');
    router.refresh();
  } catch {
    toast.error('Sign-out did not complete', {
      description: 'Check the connection and try again.',
    });
  }
}
