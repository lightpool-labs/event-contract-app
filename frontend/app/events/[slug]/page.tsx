import { api } from "@/lib/api";
import EventDetailClient from "./EventDetailClient";

function parseOutcome(value?: string): "yes" | "no" {
  if (value === "no") {
    return "no";
  }
  return "yes";
}

export default async function EventDetailPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { outcome?: string };
}) {
  let event = null;

  try {
    event = await api.getEvent(params.slug);
  } catch {
    event = null;
  }

  return (
    <EventDetailClient
      params={params}
      initialEvent={event}
      initialOutcome={parseOutcome(searchParams.outcome)}
    />
  );
}
