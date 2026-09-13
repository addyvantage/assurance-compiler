import { cn } from '../ui/cn';

/**
 * The mark: a solid square set in the corner of a frame, the tombstone that closes a proof.
 * It reads as "established" and stays legible at 16px in both themes.
 */
export function Mark({
  size = 20,
  className,
}: {
  readonly size?: number;
  readonly className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={cn('shrink-0', className)}
    >
      <rect x="0.5" y="0.5" width="19" height="19" rx="5.5" fill="var(--ink)" />
      <rect x="10" y="10" width="5.5" height="5.5" rx="1.4" fill="var(--accent)" />
    </svg>
  );
}

export function Wordmark({ className }: { readonly className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <Mark size={22} />
      <span className="text-[15px] font-semibold tracking-[-0.02em] text-ink">
        Assurance Compiler
      </span>
    </span>
  );
}
