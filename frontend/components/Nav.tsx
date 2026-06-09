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
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
        <Link href="/" className="text-lg font-semibold text-slate-900">
          LightPool Events
        </Link>
        <nav className="flex items-center gap-4 text-sm">
          <span className="text-slate-600">
            Portfolio {portfolioLabel(portfolio)}
          </span>
          <span className="text-slate-600">Cash {cashLabel(cash)}</span>
          <Link
            href="/dashboard"
            className={
              dashboardActive
                ? "font-medium text-slate-900"
                : "text-slate-600 hover:text-slate-900"
            }
          >
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
