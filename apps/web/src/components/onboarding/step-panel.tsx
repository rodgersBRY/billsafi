export function StepPanel({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="w-full max-w-117.5 self-start rounded-panel border border-line bg-panel p-5.75 sm:p-7">
      <h1 className="text-2xl leading-tight font-semibold tracking-tight">{title}</h1>
      {description && <p className="mt-2 text-sm text-sub">{description}</p>}
      {children}
    </section>
  );
}
