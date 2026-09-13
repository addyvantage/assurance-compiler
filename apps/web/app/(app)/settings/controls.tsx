'use client';

import { LoaderCircle, Monitor, Moon, Sun, Unlink } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { applyTheme, useThemeChoice, type ThemeChoice } from '@/components/app/theme';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { Input, Label } from '@/components/ui/field';
import { Segmented } from '@/components/ui/segmented';
import { renameWorkspace, revokeCliSession, unlinkRepository } from './actions';

/** Runs a settings action and reports what actually happened. */
async function settle(
  action: () => Promise<boolean>,
  success: string,
  failure: string,
): Promise<boolean> {
  try {
    if (await action()) {
      toast.success(success);
      return true;
    }
    toast.error(failure, { description: 'Reload the page to see the current settings.' });
  } catch {
    toast.error(failure, { description: 'Check the connection and try again.' });
  }
  return false;
}

export function WorkspaceNameForm({ name }: { readonly name: string }) {
  const [value, setValue] = useState(name);
  const [saved, setSaved] = useState(name);
  const [pending, startTransition] = useTransition();
  const trimmed = value.trim();
  return (
    <form
      className="flex max-w-md flex-wrap items-end gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        startTransition(async () => {
          if (await settle(() => renameWorkspace(form), 'Workspace renamed', 'Name not saved')) {
            setSaved(trimmed);
          }
        });
      }}
    >
      <div className="grid min-w-[220px] flex-1 gap-1.5">
        <Label htmlFor="workspace-name">Name</Label>
        <Input
          id="workspace-name"
          name="name"
          value={value}
          maxLength={80}
          required
          onChange={(event) => {
            setValue(event.target.value);
          }}
        />
      </div>
      <Button
        type="submit"
        disabled={pending || trimmed === '' || trimmed === saved}
        className="h-9"
      >
        {pending ? <LoaderCircle className="animate-spin" /> : null}
        Save name
      </Button>
    </form>
  );
}

export function ThemeControl() {
  const theme = useThemeChoice();
  return (
    <Segmented<ThemeChoice>
      label="Theme"
      value={theme}
      onChange={applyTheme}
      options={[
        { value: 'system', label: 'System', icon: <Monitor /> },
        { value: 'light', label: 'Light', icon: <Sun /> },
        { value: 'dark', label: 'Dark', icon: <Moon /> },
      ]}
    />
  );
}

export function RevokeCliButton({ id, label }: { readonly id: string; readonly label: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!pending) setOpen(next);
      }}
    >
      <DialogTrigger asChild>
        <Button variant="danger" size="sm">
          Revoke
        </Button>
      </DialogTrigger>
      <DialogContent
        title={`Revoke ${label}?`}
        description="Its credential stops working immediately. Runs it already reported stay in history. The machine can sign in again with assure login."
      >
        <div className="flex justify-end gap-2">
          <DialogClose asChild>
            <Button disabled={pending}>Cancel</Button>
          </DialogClose>
          <Button
            variant="danger"
            disabled={pending}
            onClick={() => {
              const form = new FormData();
              form.set('id', id);
              startTransition(async () => {
                if (
                  await settle(
                    () => revokeCliSession(form),
                    `Revoked ${label}`,
                    `${label} was not revoked`,
                  )
                ) {
                  setOpen(false);
                }
              });
            }}
          >
            {pending ? <LoaderCircle className="animate-spin" /> : null}
            Revoke CLI
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function UnlinkButton({
  cliSessionId,
  repositoryId,
  name,
}: {
  readonly cliSessionId: string;
  readonly repositoryId: string;
  readonly name: string;
}) {
  const [pending, startTransition] = useTransition();
  return (
    <Button
      size="sm"
      disabled={pending}
      onClick={() => {
        const form = new FormData();
        form.set('cliSessionId', cliSessionId);
        form.set('repositoryId', repositoryId);
        startTransition(async () => {
          await settle(
            () => unlinkRepository(form),
            `Unlinked ${name}`,
            `${name} was not unlinked`,
          );
        });
      }}
    >
      {pending ? <LoaderCircle className="animate-spin" /> : <Unlink />}
      Unlink
    </Button>
  );
}
