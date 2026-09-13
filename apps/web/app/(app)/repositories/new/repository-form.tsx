'use client';

import { LoaderCircle } from 'lucide-react';
import { useActionState } from 'react';
import { Button } from '@/components/ui/button';
import { Field, FormError, Input } from '@/components/ui/field';
import { createRepository, type RepositoryFormState } from '../actions';

const initial: RepositoryFormState = { error: null };

export function RepositoryForm({ footer }: { readonly footer?: React.ReactNode }) {
  const [state, action, pending] = useActionState(createRepository, initial);
  return (
    <form
      action={action}
      className="grid gap-4"
      aria-describedby={state.error === null ? undefined : 'repo-error'}
    >
      {state.error === null ? null : <FormError id="repo-error">{state.error}</FormError>}
      <Field
        label="Name"
        htmlFor="repo-name"
        hint="How it appears in lists. Unique within the workspace."
      >
        <Input
          id="repo-name"
          name="name"
          required
          maxLength={100}
          placeholder="billing-service"
          autoComplete="off"
        />
      </Field>
      <Field
        label="Repository URL"
        htmlFor="repo-url"
        hint="Optional, for reference. Entering a URL does not grant or prove access to it."
      >
        <Input
          id="repo-url"
          name="remoteUrl"
          maxLength={500}
          placeholder="https://github.com/org/billing-service"
        />
      </Field>
      <div className="flex items-center justify-end gap-2 pt-1">
        {footer}
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? <LoaderCircle className="animate-spin" /> : null}
          Register repository
        </Button>
      </div>
    </form>
  );
}
