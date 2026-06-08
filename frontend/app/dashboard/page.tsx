import { api } from "@/lib/api";
import type { BalanceEntry, Order } from "@/lib/types";
import DashboardTabs from "@/components/DashboardTabs";

type Tab = "assets" | "open" | "history";

function parseTab(value?: string): Tab {
  if (value === "open" || value === "history") {
    return value;
  }
  return "assets";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  let balances: BalanceEntry[] = [];
  let orders: Order[] = [];
  let error: string | null = null;

  try {
    [balances, orders] = await Promise.all([api.getBalances(), api.listOrders()]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load dashboard data";
  }

  return (
    <DashboardTabs
      activeTab={parseTab(searchParams.tab)}
      balances={balances}
      orders={orders}
      error={error}
    />
  );
}
