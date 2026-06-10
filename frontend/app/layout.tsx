import "./globals.css";
import type { Metadata } from "next";
import { NavBar } from "@/components/NavBar";
import { api } from "@/lib/api";
import { loadPortfolioSummary } from "@/lib/portfolio";

export const metadata: Metadata = {
  title: "LightPool Event Contracts",
  description: "Prediction markets on LightPool",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let portfolio = 0;
  let cash = 0;
  let userAddress: string | null = null;

  try {
    const summary = await loadPortfolioSummary();
    portfolio = summary.portfolio;
    cash = summary.cash;
  } catch {
    // Keep nav values at zero when backend is unavailable.
  }

  try {
    const account = await api.getAccount();
    userAddress = account.address;
  } catch {
    // Address stays null when backend is unavailable.
  }

  return (
    <html lang="en">
      <body className="min-h-screen bg-sky-50 text-slate-900">
        <NavBar
          initialPortfolio={portfolio}
          initialCash={cash}
          userAddress={userAddress}
        />
        <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
