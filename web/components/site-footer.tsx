import Link from "next/link";
import Image from "next/image";

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-7xl px-4 pb-8 pt-4 sm:px-8">
      <div className="panel flex flex-col gap-3 px-4 py-4 text-xs text-slate-200 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Image src="/brand/vidra-mark.svg" alt="Vidra logo" width={24} height={24} />
          <p>
            <span className="font-bold text-cyan-100">Vidra by Lexa AI</span> · AI Influencer Operating System
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/legal/terms" className="text-cyan-100 hover:underline">
            Terms
          </Link>
          <Link href="/legal/privacy" className="text-cyan-100 hover:underline">
            Privacy
          </Link>
          <Link href="/legal/cookies" className="text-cyan-100 hover:underline">
            Cookies
          </Link>
        </div>
      </div>
    </footer>
  );
}
