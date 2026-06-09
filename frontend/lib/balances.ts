import type { BalanceEntry } from "./types";

function parseAmount(value: string): number {
  const n = Number.parseFloat(value);
  return Number.isFinite(n) ? n : 0;
}

export function sumPortfolio(balances: BalanceEntry[]): number {
  return balances
    .filter((b) => b.symbol === "YES" || b.symbol === "NO")
    .reduce((sum, b) => sum + parseAmount(b.total), 0);
}

export function sumCash(balances: BalanceEntry[]): number {
  return balances
    .filter((b) => b.symbol === "USDT")
    .reduce((sum, b) => sum + parseAmount(b.total), 0);
}

export function formatUsd(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function portfolioLabel(value: number): string {
  return `$${formatUsd(value)}`;
}

export function cashLabel(value: number): string {
  return `$${formatUsd(value)}`;
}
