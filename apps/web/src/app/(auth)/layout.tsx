import { BrandMark } from "@/components/ui/brand-mark";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-4 sm:p-6">
      <BrandMark />
      <div className="w-full max-w-md rounded-panel border border-line bg-panel p-6 sm:p-7">
        {children}
      </div>
    </main>
  );
}
