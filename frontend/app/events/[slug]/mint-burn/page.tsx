import { api } from "@/lib/api";
import EventMintBurnTabs from "@/components/EventMintBurnTabs";

type Tab = "mint" | "burn";

function parseTab(value?: string): Tab {
  if (value === "burn") {
    return value;
  }
  return "mint";
}

export default async function EventMintBurnPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { tab?: string };
}) {
  let event = null;

  try {
    event = await api.getEvent(params.slug);
  } catch {
    event = null;
  }

  if (!event) {
    return <p className="text-sm text-slate-500">Event not found.</p>;
  }

  return <EventMintBurnTabs event={event} activeTab={parseTab(searchParams.tab)} />;
}
