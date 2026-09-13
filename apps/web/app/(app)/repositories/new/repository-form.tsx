'use client';

import { useActionState } from 'react';
import { createRepository, type RepositoryFormState } from '../actions';

const initial: RepositoryFormState = { error: null };

export function RepositoryForm() {
  const [state, action, pending] = useActionState(createRepository, initial);
  return (
    <form action={action} aria-describedby={state.error === null ? undefined : 'repo-error'}>
      {state.error !== null ? (
        <p id="repo-error" className="form-error" role="alert">
          {state.error}
        </p>
      ) : null}
      <div className="field">
        <label htmlFor="name">Name</label>
        <input
          id="name"
          name="name"
          className="input"
          required
          maxLength={100}
          placeholder="billing-service"
        />
        <span className="hint">How it appears in lists. Unique within the workspace.</span>
      </div>
      <div className="field">
        <label htmlFor="remoteUrl">Repository URL (optional)</label>
        <input
          id="remoteUrl"
          name="remoteUrl"
          className="input"
          maxLength={500}
          placeholder="https://github.com/org/billing-service"
        />
        <span className="hint">
          Shown for reference only. Entering a URL does not prove access to it.
        </span>
      </div>
      <div className="form-actions">
        <button type="submit" className="button primary" disabled={pending}>
          {pending ? 'Registering' : 'Register repository'}
        </button>
      </div>
    </form>
  );
}
