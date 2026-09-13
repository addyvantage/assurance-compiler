import Link from 'next/link';
import type { ReactNode } from 'react';
import { NavLinks, SignOutButton } from './nav';

export function Wordmark() {
  return (
    <Link href="/repositories" className="wordmark" aria-label="Assurance Compiler">
      <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
        <rect
          x="1"
          y="1"
          width="16"
          height="16"
          rx="3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M5 9.5l2.5 2.5L13 6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Assurance Compiler
    </Link>
  );
}

export function Shell({
  workspaceName,
  email,
  children,
}: {
  readonly workspaceName: string;
  readonly email: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="shell">
      <aside className="rail">
        <Wordmark />
        <NavLinks />
        <div className="rail-footer">
          <div>
            <strong title={workspaceName}>{workspaceName}</strong>
            <span title={email}>{email}</span>
          </div>
          <div>
            <SignOutButton />
          </div>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

export function PageHeader({
  title,
  description,
  actions,
  crumbs,
}: {
  readonly title: string;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
  readonly crumbs?: readonly { href: string; label: string }[];
}) {
  return (
    <header className="page-header">
      <div>
        {crumbs !== undefined && crumbs.length > 0 ? (
          <div className="crumbs">
            {crumbs.map((crumb) => (
              <span key={crumb.href}>
                <Link href={crumb.href}>{crumb.label}</Link> /
              </span>
            ))}
          </div>
        ) : null}
        <h1>{title}</h1>
        {description !== undefined ? <p>{description}</p> : null}
      </div>
      {actions !== undefined ? <div className="form-actions">{actions}</div> : null}
    </header>
  );
}
