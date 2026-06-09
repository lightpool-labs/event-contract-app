import "./globals.css";
import type { Metadata } from "next";
import { Nav } from "@/components/Nav";
import { api } from "@/lib/api";
import { sumCash, sumPortfolio } from "@/lib/balances";

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
    const balances = await api.getBalances();
    portfolio = sumPortfolio(balances);
    cash = sumCash(balances);
  } catch {
    // Keep nav values at zero when backend is unavailable.
  }

  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <Nav portfolio={portfolio} cash={cash} />
        <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
      </body>
    </html>
  );
}
