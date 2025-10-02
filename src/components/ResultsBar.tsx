"use client";

import { useCallback, useMemo } from "react";
import { Copy } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import type { Currency, Person, SplitBreakdown } from "@/types";
import { formatWhatsApp, plainCurrency } from "@/lib/format";
import { events } from "@/lib/events";

const TAX_LABELS: Record<Currency, string> = {
  SGD: "GST",
  MYR: "SST",
  IDR: "VAT",
  THB: "VAT",
  PHP: "VAT",
  VND: "VAT",
};

interface ResultsBarProps {
  activeTab: "items" | "total";
  itemsBreakdown: SplitBreakdown;
  totalBreakdown: SplitBreakdown;
  persons: Person[];
}

export const ResultsBar = ({
  activeTab,
  itemsBreakdown,
  totalBreakdown,
  persons,
}: ResultsBarProps) => {
  const breakdown = activeTab === "items" ? itemsBreakdown : totalBreakdown;

  const personMap = useMemo(() => new Map(persons.map((person) => [person.id, person.name])), [persons]);

  const copyPerson = useCallback(
    async (personId: string) => {
      const share = breakdown.perPerson.find((entry) => entry.personId === personId);
      if (!share) return;
      const name = personMap.get(personId) ?? "Friend";
      const taxLabel = TAX_LABELS[breakdown.currency] ?? "Tax";
      const line = `${name}: ${plainCurrency(share.total, breakdown.currency)} (Items: ${share.items.toFixed(2)} + SC: ${share.serviceCharge.toFixed(2)} + ${taxLabel}: ${share.tax.toFixed(2)})`;
      try {
        await navigator.clipboard.writeText(line);
        toast.success(`Copied ${name}`);
        events.emit("copy_person", { personId });
      } catch {
        toast.error("Clipboard unavailable");
      }
    },
    [breakdown, personMap],
  );

  const copyAll = useCallback(async () => {
    const text = formatWhatsApp(breakdown, persons);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied summary");
      events.emit("copy_all");
    } catch {
      toast.error("Clipboard unavailable");
    }
  }, [breakdown, persons]);

  return (
    <aside className="sticky bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-4 sm:px-6 lg:px-10">
        <div className="flex flex-wrap items-center gap-4 rounded-lg border border-red-100 bg-red-50 px-3 py-2 text-sm text-muted-foreground">
          <span>
            Items: <span className="font-semibold text-red-700">{plainCurrency(breakdown.beforeCharge, breakdown.currency)}</span>
          </span>
          <span>
            Service charge: <span className="font-semibold text-red-700">{plainCurrency(breakdown.serviceChargeTotal, breakdown.currency)}</span>
          </span>
          <span>
            Tax: <span className="font-semibold text-red-700">{plainCurrency(breakdown.taxTotal, breakdown.currency)}</span>
          </span>
          <span>
            Grand total: <span className="font-semibold text-red-700">{plainCurrency(breakdown.grandTotal, breakdown.currency)}</span>
          </span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="max-h-32 w-full overflow-x-auto sm:max-w-3xl">
            <div className="flex w-max gap-2">
              {breakdown.perPerson.map((share) => {
                const name = personMap.get(share.personId) ?? "Friend";
                return (
                  <div key={share.personId} className="flex min-w-[180px] flex-col gap-1 rounded-xl border border-border bg-white px-4 py-3 shadow-sm">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium">{name}</span>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => copyPerson(share.personId)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-base font-semibold">{plainCurrency(share.total, breakdown.currency)}</p>
                    <p className="text-xs text-muted-foreground">
                      Items {share.items.toFixed(2)} • SC {share.serviceCharge.toFixed(2)} • Tax {share.tax.toFixed(2)}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="flex flex-shrink-0 items-center gap-2 self-end sm:self-auto">
            <Button variant="outline" className="gap-2" onClick={copyAll}>
              <Copy className="h-4 w-4" /> Copy summary
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );
};
