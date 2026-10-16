export function AuthHeading({ title, description }: { title: string; description?: string }) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {description && <p className="mt-2 text-sm text-sub">{description}</p>}
    </>
  );
}
