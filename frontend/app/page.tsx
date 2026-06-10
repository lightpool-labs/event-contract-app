import { api } from "@/lib/api";
import { EventListItem } from "@/components/EventListItem";
import type { Event } from "@/lib/types";

export default async function HomePage() {
  let events: Event[] = [];
  let error: string | null = null;

  try {
    events = await api.listEvents();
  } catch (e) {
    error = e instanceof Error ? e.message : "Failed to load events";
  }

  return (
    <div>
      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {events.map((event) => (
          <EventListItem key={event.id} event={event} />
        ))}

        {!error && events.length === 0 && (
          <p className="text-sm text-slate-500">No events yet.</p>
        )}
      </div>
    </div>
  );
}
