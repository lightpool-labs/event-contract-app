import { redirect } from "next/navigation";

export default function OrdersRedirectPage() {
  redirect("/portfolio?tab=open");
}
