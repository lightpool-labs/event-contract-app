"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Nav } from "@/components/Nav";
import {
  loadPortfolioSummary,
  PORTFOLIO_REFRESH_EVENT,
} from "@/lib/portfolio";

type NavBarProps = {
  initialPortfolio: number;
  initialCash: number;
  userAddress: string | null;
};

export function NavBar({
  initialPortfolio,
  initialCash,
  userAddress,
}: NavBarProps) {
  const pathname = usePathname();
  const [portfolio, setPortfolio] = useState(initialPortfolio);
  const [cash, setCash] = useState(initialCash);

  useEffect(() => {
    setPortfolio(initialPortfolio);
    setCash(initialCash);
  }, [initialPortfolio, initialCash]);

  useEffect(() => {
    let cancelled = false;

    async function refreshBalances() {
      try {
        const summary = await loadPortfolioSummary();
        if (!cancelled) {
          setPortfolio(summary.portfolio);
          setCash(summary.cash);
        }
      } catch {
        // Keep the last known values when refresh fails.
      }
    }

    function onRefresh() {
      void refreshBalances();
    }

    window.addEventListener(PORTFOLIO_REFRESH_EVENT, onRefresh);
    void refreshBalances();

    return () => {
      cancelled = true;
      window.removeEventListener(PORTFOLIO_REFRESH_EVENT, onRefresh);
    };
  }, [pathname]);

  return <Nav portfolio={portfolio} cash={cash} userAddress={userAddress} />;
}
