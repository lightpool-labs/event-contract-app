import Link from "next/link";

export function Nav() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold text-slate-900">
          LightPool Events
        </Link>
        <nav className="text-sm">
          <Link href="/dashboard" className="text-slate-600 hover:text-slate-900">
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
