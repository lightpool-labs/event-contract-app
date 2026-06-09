"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cashLabel, portfolioLabel } from "@/lib/balances";

type NavProps = {
  portfolio: number;
  cash: number;
};

export function Nav({ portfolio, cash }: NavProps) {
  const pathname = usePathname();
  const dashboardActive =
    pathname === "/dashboard" || pathname.startsWith("/dashboard?");

  return (
    <header className="border-b border-sky-100 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold text-sky-700">
          LightPool Events
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <span className="text-slate-600">
            Portfolio {portfolioLabel(portfolio)}
          </span>
          <span className="rounded-full bg-sky-100 px-3 py-1 text-sky-700">
            Cash {cashLabel(cash)}
          </span>
          <Link
            href="/dashboard"
            className={
              dashboardActive
                ? "font-medium text-sky-700"
                : "text-slate-600 hover:text-sky-700"
            }
          >
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
