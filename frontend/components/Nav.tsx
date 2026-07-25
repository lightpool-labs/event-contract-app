"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cashLabel, portfolioLabel } from "@/lib/balances";
import { formatAddress } from "@/lib/address";

type NavProps = {
  portfolio: number;
  cash: number;
  userAddress: string | null;
};

export function Nav({ portfolio, cash, userAddress }: NavProps) {
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
          <Link
            href="/"
            className={
              pathname === "/" || pathname.startsWith("/markets")
                ? "font-medium text-sky-700"
                : "text-slate-600 hover:text-sky-700"
            }
          >
            Markets
          </Link>
          <Link
            href="/vaults"
            className={
              pathname === "/vaults" || pathname.startsWith("/vaults/")
                ? "font-medium text-sky-700"
                : "text-slate-600 hover:text-sky-700"
            }
          >
            Vaults
          </Link>
          <span className="text-slate-600">
            Portfolio {portfolioLabel(portfolio)}
          </span>
          <span className="text-slate-600">
            Cash {cashLabel(cash)}
          </span>
          <Link
            href="/dashboard"
            className={[
              "rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 font-mono text-xs font-medium text-emerald-700 transition hover:bg-emerald-100",
              dashboardActive ? "border-emerald-300" : "",
            ].join(" ")}
            title={userAddress ?? undefined}
          >
            {userAddress ? formatAddress(userAddress) : "Dashboard"}
          </Link>
        </nav>
      </div>
    </header>
  );
}
