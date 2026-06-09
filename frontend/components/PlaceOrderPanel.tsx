"use client";

type OrderSide = "buy" | "sell";
type OrderType = "limit" | "market";
type Outcome = "yes" | "no";

const QUICK_AMOUNTS = [1, 5, 10, 25, 50];

type PlaceOrderPanelProps = {
  outcome: Outcome;
  side: OrderSide;
  orderType: OrderType;
  price: string;
  size: string;
  loading: boolean;
  message: string | null;
  onSideChange: (side: OrderSide) => void;
  onOrderTypeChange: (orderType: OrderType) => void;
  onPriceChange: (price: string) => void;
  onSizeChange: (size: string) => void;
  onSubmit: (e: React.FormEvent) => void;
};

function TabItem({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "border-b-2 pb-2 text-sm font-medium transition",
        active
          ? "border-sky-500 text-slate-900"
          : "border-transparent text-slate-500 hover:text-slate-800",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function OrderTypeToggle({
  value,
  onChange,
}: {
  value: OrderType;
  onChange: (orderType: OrderType) => void;
}) {
  function toggleOrderType() {
    onChange(value === "limit" ? "market" : "limit");
  }

  return (
    <button
      type="button"
      aria-label={`Switch to ${value === "limit" ? "market" : "limit"} order`}
      onClick={toggleOrderType}
      className="inline-flex cursor-pointer items-center pb-2 text-sm font-medium text-slate-700 hover:text-slate-900"
    >
      <span>{value === "limit" ? "Limit" : "Market"}</span>
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="ml-[2ch] h-3.5 w-3.5 shrink-0 text-slate-500"
      >
        <path
          fillRule="evenodd"
          d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z"
          clipRule="evenodd"
        />
      </svg>
    </button>
  );
}

export function PlaceOrderPanel({
  outcome,
  side,
  orderType,
  price,
  size,
  loading,
  message,
  onSideChange,
  onOrderTypeChange,
  onPriceChange,
  onSizeChange,
  onSubmit,
}: PlaceOrderPanelProps) {
  const submitLabel =
    side === "buy"
      ? `Buy ${outcome === "yes" ? "Yes" : "No"}`
      : `Sell ${outcome === "yes" ? "Yes" : "No"}`;

  return (
    <section className="sticky top-6 rounded-xl border border-sky-100 bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-end justify-between border-b border-slate-200">
        <div className="flex gap-5">
          <TabItem label="Buy" active={side === "buy"} onClick={() => onSideChange("buy")} />
          <TabItem label="Sell" active={side === "sell"} onClick={() => onSideChange("sell")} />
        </div>
        <OrderTypeToggle value={orderType} onChange={onOrderTypeChange} />
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        {orderType === "limit" && (
          <label className="block text-sm">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Limit price (¢)
            </span>
            <input
              type="number"
              min="0"
              max="100"
              step="1"
              className="w-full rounded-lg border border-sky-100 px-3 py-2.5 outline-none ring-sky-200 focus:border-sky-400 focus:ring-2"
              value={price}
              onChange={(e) => onPriceChange(e.target.value)}
            />
          </label>
        )}

        <div>
          <label className="block text-sm">
            <span className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-500">
              Amount
            </span>
            <input
              type="number"
              min="0"
              step="0.000001"
              className="w-full rounded-lg border border-sky-100 px-3 py-2.5 outline-none ring-sky-200 focus:border-sky-400 focus:ring-2"
              value={size}
              onChange={(e) => onSizeChange(e.target.value)}
            />
          </label>
          <div className="mt-2 flex flex-wrap gap-2">
            {QUICK_AMOUNTS.map((amount) => (
              <button
                key={amount}
                type="button"
                onClick={() => onSizeChange(String(amount))}
                className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-700 hover:bg-sky-100"
              >
                {amount}
              </button>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={[
            "w-full rounded-lg px-4 py-3 text-sm font-semibold text-white transition disabled:opacity-50",
            side === "buy" ? "bg-emerald-500 hover:bg-emerald-600" : "bg-rose-500 hover:bg-rose-600",
          ].join(" ")}
        >
          {loading ? "Submitting..." : submitLabel}
        </button>
      </form>

      {message && <p className="mt-3 text-sm text-slate-600">{message}</p>}
    </section>
  );
}
