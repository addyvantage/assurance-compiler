'use client';

import { Plus } from 'lucide-react';
import { Button, type ButtonSize, type ButtonVariant } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { RepositoryForm } from './new/repository-form';

export function RegisterRepository({
  variant = 'primary',
  size = 'sm',
}: {
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant={variant} size={size}>
          <Plus />
          Register repository
        </Button>
      </DialogTrigger>
      <DialogContent
        title="Register a repository"
        description="Records a name and an optional URL in your workspace. Nothing is fetched and no GitHub access is requested; verification runs from the CLI you link next."
      >
        <RepositoryForm
          footer={
            <DialogClose asChild>
              <Button>Cancel</Button>
            </DialogClose>
          }
        />
      </DialogContent>
    </Dialog>
  );
}
