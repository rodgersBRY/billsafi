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
