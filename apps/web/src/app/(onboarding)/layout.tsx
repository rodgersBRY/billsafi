export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-5 sm:px-7">
        <span className="text-2xl font-semibold tracking-tight text-accent">Billsafi</span>
        <span className="text-xs text-sub">A simpler start to invoicing</span>
      </header>
      <main className="grid flex-1 content-start gap-6 p-4 sm:p-8 lg:grid-cols-[13.75rem_1fr_13.75rem] lg:gap-9">
        {children}
      </main>
    </div>
  );
}
