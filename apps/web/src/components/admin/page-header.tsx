interface PageHeaderProps {
  title: string;
  description: string;
  /** Page-level actions, shown beside the title. */
  actions?: React.ReactNode;
  /** Badges or facts under the description, such as a tenant's statuses. */
  children?: React.ReactNode;
}

/** The title block every admin page starts with. */
export function PageHeader({ title, description, actions, children }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1 basis-80">
        <h1 className="text-2xl font-semibold tracking-tight break-words">{title}</h1>
        <p className="mt-1 text-sm text-sub">{description}</p>
        {children}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
