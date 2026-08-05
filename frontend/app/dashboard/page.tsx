import { redirect } from "next/navigation";

export default function DashboardRedirectPage({
  searchParams,
}: {
  searchParams: { tab?: string };
}) {
  const tab = searchParams.tab;
  if (tab === "open" || tab === "history") {
    redirect(`/portfolio?tab=${tab}`);
  }
  redirect("/portfolio");
}
