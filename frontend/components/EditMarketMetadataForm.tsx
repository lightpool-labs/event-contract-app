"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import type { Market } from "@/lib/types";
import { MarketIcon } from "@/components/MarketIcon";

function hasMetadata(market: Market): boolean {
  return Boolean(market.event_slug || market.group_item_title || market.icon_url);
}

export function EditMarketMetadataForm() {
  const [markets, setMarkets] = useState<Market[]>([]);
  const [slugInput, setSlugInput] = useState("");
  const [selectedSlug, setSelectedSlug] = useState("");
  const [selectedSlugs, setSelectedSlugs] = useState<string[]>([]);
  const [eventSlug, setEventSlug] = useState("");
  const [groupItemTitle, setGroupItemTitle] = useState("");
  const [iconUrl, setIconUrl] = useState("");
  const [loadingMarkets, setLoadingMarkets] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loadingSelected, setLoadingSelected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  const refreshMarkets = useCallback(async () => {
    const list = await api.listMarkets();
    setMarkets(list);
    return list;
  }, []);

  useEffect(() => {
    let active = true;

    async function loadMarkets() {
      try {
        const list = await refreshMarkets();
        if (!active) {
          return;
        }
        if (list.length > 0) {
          setSelectedSlug((current) => current || list[0].slug);
          setSlugInput((current) => current || list[0].slug);
        }
      } catch (err) {
        if (active) {
          setError(err instanceof Error ? err.message : "Failed to load markets");
        }
      } finally {
        if (active) {
          setLoadingMarkets(false);
        }
      }
    }

    void loadMarkets();
    return () => {
      active = false;
    };
  }, [refreshMarkets]);

  const selected = useMemo(
    () => markets.find((market) => market.slug === selectedSlug) ?? null,
    [markets, selectedSlug],
  );

  useEffect(() => {
    if (!selected) {
      return;
    }
    setEventSlug(selected.event_slug ?? "");
    setGroupItemTitle(selected.group_item_title ?? "");
    setIconUrl(selected.icon_url ?? "");
    setError(null);
  }, [selected]);

  const filteredMarkets = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) {
      return markets;
    }
    return markets.filter((market) => {
      return (
        market.slug.toLowerCase().includes(q) ||
        market.question.toLowerCase().includes(q) ||
        (market.event_slug ?? "").toLowerCase().includes(q) ||
        (market.group_item_title ?? "").toLowerCase().includes(q)
      );
    });
  }, [filter, markets]);

  function selectMarket(slug: string) {
    setSelectedSlug(slug);
    setSlugInput(slug);
    setMessage(null);
  }

  function toggleSelected(slug: string) {
    setSelectedSlugs((prev) =>
      prev.includes(slug) ? prev.filter((value) => value !== slug) : [...prev, slug],
    );
  }

  async function loadBySlug() {
    const slug = slugInput.trim();
    if (!slug) {
      setError("Enter a market slug.");
      return;
    }

    setLoadingSelected(true);
    setError(null);
    setMessage(null);

    try {
      const market = await api.getMarket(slug);
      setMarkets((prev) => {
        const exists = prev.some((item) => item.slug === market.slug);
        return exists
          ? prev.map((item) => (item.slug === market.slug ? { ...item, ...market } : item))
          : [market, ...prev];
      });
      selectMarket(market.slug);
      setMessage(`Loaded market: ${market.question}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load market by slug");
    } finally {
      setLoadingSelected(false);
    }
  }

  async function onSaveOne(e: React.FormEvent) {
    e.preventDefault();
    const slug = selectedSlug.trim() || slugInput.trim();
    if (!slug) {
      setError("Select or enter a market slug.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const updated = await api.updateMarketMetadata(slug, {
        event_slug: eventSlug.trim(),
        group_item_title: groupItemTitle.trim(),
        icon_url: iconUrl.trim(),
      });
      setMarkets((prev) => {
        const exists = prev.some((market) => market.slug === updated.slug);
        return exists
          ? prev.map((market) =>
              market.slug === updated.slug ? { ...market, ...updated } : market,
            )
          : [updated, ...prev];
      });
      selectMarket(updated.slug);
      setMessage(
        `Saved metadata for ${updated.slug}` +
          (updated.event_slug ? ` · event=${updated.event_slug}` : "") +
          (updated.group_item_title ? ` · item=${updated.group_item_title}` : ""),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update metadata");
    } finally {
      setLoading(false);
    }
  }

  async function onApplyEventSlugToSelected() {
    const sharedEventSlug = eventSlug.trim();
    if (!sharedEventSlug) {
      setError("Event slug is required for batch update.");
      return;
    }
    if (selectedSlugs.length === 0) {
      setError("Select at least one market in the list.");
      return;
    }

    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const updatedList: Market[] = [];
      for (const slug of selectedSlugs) {
        const current = markets.find((market) => market.slug === slug);
        const updated = await api.updateMarketMetadata(slug, {
          event_slug: sharedEventSlug,
          group_item_title: current?.group_item_title ?? "",
          icon_url: current?.icon_url ?? "",
        });
        updatedList.push(updated);
      }

      setMarkets((prev) =>
        prev.map((market) => {
          const next = updatedList.find((item) => item.slug === market.slug);
          return next ? { ...market, ...next } : market;
        }),
      );
      setMessage(
        `Applied event_slug="${sharedEventSlug}" to ${updatedList.length} market(s).`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Batch update failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
      <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Existing markets (from clob)</h3>
          <button
            type="button"
            onClick={() => {
              setLoadingMarkets(true);
              void refreshMarkets()
                .catch((err) => {
                  setError(err instanceof Error ? err.message : "Failed to refresh markets");
                })
                .finally(() => setLoadingMarkets(false));
            }}
            className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>

        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by question / slug / event_slug"
          className="mb-3 w-full rounded border border-slate-300 px-3 py-2 text-sm"
        />

        {loadingMarkets ? (
          <p className="text-sm text-slate-500">Loading markets...</p>
        ) : filteredMarkets.length === 0 ? (
          <p className="text-sm text-slate-500">No markets found.</p>
        ) : (
          <ul className="max-h-[28rem] space-y-2 overflow-y-auto">
            {filteredMarkets.map((market) => {
              const active = market.slug === selectedSlug;
              const checked = selectedSlugs.includes(market.slug);
              return (
                <li key={market.id}>
                  <div
                    className={[
                      "flex items-start gap-2 rounded-lg border px-3 py-2",
                      active
                        ? "border-sky-300 bg-sky-50"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    ].join(" ")}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleSelected(market.slug)}
                      className="mt-1"
                      aria-label={`Select ${market.slug}`}
                    />
                    <button
                      type="button"
                      onClick={() => selectMarket(market.slug)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-start gap-2">
                        <MarketIcon
                          iconUrl={market.icon_url}
                          question={market.question}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900">
                            {market.question}
                          </p>
                          <p className="mt-0.5 break-all font-mono text-[11px] text-slate-500">
                            {market.slug}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {market.group_item_title && (
                              <span className="rounded bg-sky-100 px-1.5 py-0.5 text-[10px] text-sky-700">
                                {market.group_item_title}
                              </span>
                            )}
                            {market.event_slug ? (
                              <span className="rounded bg-emerald-100 px-1.5 py-0.5 font-mono text-[10px] text-emerald-700">
                                {market.event_slug}
                              </span>
                            ) : (
                              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] text-amber-700">
                                no event_slug
                              </span>
                            )}
                            {!hasMetadata(market) && (
                              <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                                metadata empty
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={loading || selectedSlugs.length === 0}
            onClick={() => void onApplyEventSlugToSelected()}
            className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-medium text-violet-700 hover:bg-violet-100 disabled:opacity-50"
          >
            Apply event_slug to selected ({selectedSlugs.length})
          </button>
          <button
            type="button"
            onClick={() => setSelectedSlugs(filteredMarkets.map((market) => market.slug))}
            className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Select filtered
          </button>
          <button
            type="button"
            onClick={() => setSelectedSlugs([])}
            className="rounded border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            Clear selection
          </button>
        </div>
      </section>

      <section>
        <form
          onSubmit={onSaveOne}
          className="space-y-4 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
        >
          <div>
            <label htmlFor="slugInput" className="mb-1 block text-sm font-medium text-slate-700">
              Market slug (paste maker / clob slug)
            </label>
            <div className="flex gap-2">
              <input
                id="slugInput"
                type="text"
                value={slugInput}
                onChange={(e) => setSlugInput(e.target.value)}
                placeholder="will-btc-reach-100k-by-end-of-2026"
                className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => void loadBySlug()}
                disabled={loadingSelected || !slugInput.trim()}
                className="shrink-0 rounded border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                {loadingSelected ? "..." : "Load"}
              </button>
            </div>
            {selected && (
              <p className="mt-2 text-xs text-slate-500">
                Editing: <span className="font-medium text-slate-700">{selected.question}</span>
              </p>
            )}
          </div>

          <div>
            <label htmlFor="eventSlug" className="mb-1 block text-sm font-medium text-slate-700">
              Event slug
            </label>
            <input
              id="eventSlug"
              type="text"
              value={eventSlug}
              onChange={(e) => setEventSlug(e.target.value)}
              placeholder="us-announces-end-of-iranian-blockade-..."
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
            <p className="mt-1 text-xs text-slate-500">
              Shared across markets that should appear in one event box.
            </p>
          </div>

          <div>
            <label
              htmlFor="groupItemTitle"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Group item title
            </label>
            <input
              id="groupItemTitle"
              type="text"
              value={groupItemTitle}
              onChange={(e) => setGroupItemTitle(e.target.value)}
              placeholder="September 7"
              className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label
              htmlFor="metadataIconUrl"
              className="mb-1 block text-sm font-medium text-slate-700"
            >
              Icon URL
            </label>
            <div className="flex items-start gap-3">
              <MarketIcon
                iconUrl={iconUrl || null}
                question={selected?.question || slugInput || "market"}
                size="md"
              />
              <input
                id="metadataIconUrl"
                type="url"
                value={iconUrl.startsWith("data:") ? "" : iconUrl}
                onChange={(e) => setIconUrl(e.target.value)}
                placeholder="https://example.com/icon.png"
                className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !(selectedSlug || slugInput.trim())}
            className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-medium text-sky-700 transition hover:bg-sky-100 disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save metadata for this market"}
          </button>
        </form>

        {error && (
          <div className="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-4 rounded border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            {message}
          </div>
        )}
      </section>
    </div>
  );
}
