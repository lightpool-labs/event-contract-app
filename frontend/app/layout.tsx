import "./globals.css";
import type { Metadata } from "next";
import { NavBar } from "@/components/NavBar";
import { WalletProviders } from "@/lib/wallet";
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

  try {
    const summary = await loadPortfolioSummary();
    portfolio = summary.portfolio;
    cash = summary.cash;
  } catch {
    // Keep nav values at zero when backend is unavailable.
  }

  return (
    <html lang="en">
      <body className="min-h-screen bg-sky-50 text-slate-900">
        <WalletProviders>
          <NavBar initialPortfolio={portfolio} initialCash={cash} />
          <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
        </WalletProviders>
      </body>
    </html>
  );
}
