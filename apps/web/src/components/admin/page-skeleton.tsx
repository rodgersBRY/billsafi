/** First-load placeholder for an admin page; the shell stays in place around it. */
export function PageSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="h-8 w-56 rounded-md bg-soft" />
      <div aria-hidden className="mt-2 h-4 w-80 max-w-full rounded-md bg-soft" />
      <div aria-hidden className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((key) => (
          <div key={key} className="h-28 rounded-panel border border-line bg-panel" />
        ))}
      </div>
      <div aria-hidden className="mt-6 h-72 rounded-panel border border-line bg-panel" />
    </div>
  );
}

/** First-load placeholder for a directory or log: filters, then rows. */
export function TableSkeleton({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="animate-pulse motion-reduce:animate-none">
      <span className="sr-only">{label}</span>
      <div aria-hidden className="h-8 w-48 rounded-md bg-soft" />
      <div aria-hidden className="mt-2 h-4 w-80 max-w-full rounded-md bg-soft" />
      <div aria-hidden className="mt-6 rounded-panel border border-line bg-panel">
        <div className="grid grid-cols-1 gap-3 border-b border-line p-4 md:grid-cols-3">
          {[0, 1, 2].map((key) => (
            <div key={key} className="h-10 rounded-panel bg-soft" />
          ))}
        </div>
        {[0, 1, 2, 3, 4, 5].map((key) => (
          <div key={key} className="flex gap-4 border-b border-line px-4 py-4 last:border-0">
            <div className="h-4 flex-1 rounded-md bg-soft" />
            <div className="h-4 w-24 rounded-md bg-soft" />
            <div className="hidden h-4 w-24 rounded-md bg-soft sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
