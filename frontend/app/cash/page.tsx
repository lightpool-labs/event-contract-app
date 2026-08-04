import { Suspense } from "react";
import { CashBridge } from "@/components/CashBridge";

export default function CashPage() {
  return (
    <Suspense fallback={<div className="text-sm text-slate-500">Loading…</div>}>
      <CashBridge />
    </Suspense>
  );
}
