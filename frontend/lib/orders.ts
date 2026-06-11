import type { Order } from "@/lib/types";

export function isOpenOrder(order: Order): boolean {
  return order.status === "open" || order.status === "partial_filled";
}

export function filterOrdersForBook(
  orders: Order[],
  marketSlug: string,
  outcome: "yes" | "no",
): Order[] {
  return orders.filter(
    (order) =>
      order.market_slug === marketSlug &&
      order.outcome === outcome &&
      isOpenOrder(order),
  );
}

export function bookSideForOrderSide(side: string): "ask" | "bid" {
  return side === "sell" ? "ask" : "bid";
}

export function normalizeOrderPrice(price: string): string {
  const value = Number.parseFloat(price);
  return Number.isFinite(value) ? String(value) : price.trim();
}

export function ordersAtBookLevel(
  orders: Order[],
  price: string,
  bookSide: "ask" | "bid",
): Order[] {
  const normalized = normalizeOrderPrice(price);
  return orders.filter(
    (order) =>
      normalizeOrderPrice(order.price) === normalized &&
      bookSideForOrderSide(order.side) === bookSide,
  );
}

export function bookLevelKey(bookSide: "ask" | "bid", price: string): string {
  return `${bookSide}:${normalizeOrderPrice(price)}`;
}
