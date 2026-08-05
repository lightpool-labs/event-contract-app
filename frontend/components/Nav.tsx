"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cashLabel, portfolioLabel } from "@/lib/balances";
import { ConnectWallet } from "@/components/ConnectWallet";

type NavProps = {
  portfolio: number;
  cash: number;
};

export function Nav({ portfolio, cash }: NavProps) {
  const pathname = usePathname();

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
              pathname === "/vaults"
                ? "font-medium text-sky-700"
                : "text-slate-600 hover:text-sky-700"
            }
          >
            Vaults
          </Link>
          <Link
            href="/portfolio"
            className={
              pathname === "/portfolio" || pathname.startsWith("/portfolio?")
                ? "font-medium text-sky-700"
                : "text-slate-600 hover:text-sky-700"
            }
          >
            Portfolio {portfolioLabel(portfolio)}
          </Link>
          <Link
            href="/cash"
            className={
              pathname === "/cash"
                ? "font-medium text-sky-700"
                : "text-slate-600 hover:text-sky-700"
            }
          >
            Cash {cashLabel(cash)}
          </Link>
          <ConnectWallet />
        </nav>
      </div>
    </header>
  );
}
