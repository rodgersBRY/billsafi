import Image from "next/image";

export default function Home() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="w-full max-w-md rounded-panel border border-line bg-panel p-8">
        <div className="flex items-center gap-3">
          <Image
            src="/brand/logo-mark.webp"
            alt=""
            width={32}
            height={32}
            className="rounded-lg"
            preload
          />
          <h1 className="text-2xl font-semibold tracking-tight">TallyNest</h1>
        </div>
        <p className="mt-3 text-sm text-sub">
          Invoicing for Kenyan freelancers and independent professionals. Setup in progress.
        </p>
      </div>
    </main>
  );
}
