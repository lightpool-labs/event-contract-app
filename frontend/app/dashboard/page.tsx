import { api } from "@/lib/api";
import type { BalanceEntry, Market, Order } from "@/lib/types";
import DashboardTabs from "@/components/DashboardTabs";

type Tab = "position" | "open" | "history";

function parseTab(value?: string): Tab {
  if (value === "open" || value === "history") {
    return value;
  }
  return "position";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  let balances: BalanceEntry[] = [];
  let orders: Order[] = [];
  let markets: Market[] = [];
  let error: string | null = null;

  try {
    [balances, orders, markets] = await Promise.all([
      api.getBalances(),
      api.listOrders(),
      api.listMarkets(),
    ]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load dashboard data";
  }

  return (
    <DashboardTabs
      activeTab={parseTab(searchParams.tab)}
      balances={balances}
      orders={orders}
      markets={markets}
      error={error}
    />
  );
}
