"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ChevronDown, Users, Trash2 } from "lucide-react";

import { PeopleAssign } from "@/components/PeopleAssign";
import { ResultsBar } from "@/components/ResultsBar";
import { ReceiptOcrPanel } from "@/components/ReceiptOcrPanel";
import { forward } from "@/lib/calc";
import { splitItems, splitTotal } from "@/lib/split";
import type { Country, Currency, Item, OcrLineItem, OcrResult, Person, ReceiptMetaState } from "@/types";

const COLORS = [
  "#2563eb",
  "#16a34a",
  "#f97316",
  "#a855f7",
  "#ef4444",
  "#0ea5e9",
  "#facc15",
];

const nextId = () =>
  typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2, 10)}`;

const createPerson = (index: number): Person => ({
  id: nextId(),
  name: String.fromCharCode(65 + index),
  weight: 1,
  color: COLORS[index % COLORS.length],
});

const createBlankItem = (): Item => ({
  id: nextId(),
  name: "",
  qty: 1,
  unitPrice: 0,
  assignments: [],
});

type TabKey = "items" | "total";

const INITIAL_PERSONS: Person[] = [createPerson(0), createPerson(1)];
const INITIAL_ITEMS: Item[] = [createBlankItem(), createBlankItem(), createBlankItem()];

const COUNTRY_SETTINGS: Record<Country, {
  currency: Currency;
  serviceCharge: {
    enabled: boolean;
    rate: number;
  };
  tax: {
    enabled: boolean;
    rate: number;
  };
}> = {
  Singapore: {
    currency: "SGD",
    serviceCharge: { enabled: true, rate: 0.1 },
    tax: { enabled: true, rate: 0.09 },
  },
  Malaysia: {
    currency: "MYR",
    serviceCharge: { enabled: false, rate: 0.1 },
    tax: { enabled: true, rate: 0.06 },
  },
  Indonesia: {
    currency: "IDR",
    serviceCharge: { enabled: false, rate: 0.07 },
    tax: { enabled: true, rate: 0.11 },
  },
  Thailand: {
    currency: "THB",
    serviceCharge: { enabled: false, rate: 0.1 },
    tax: { enabled: true, rate: 0.07 },
  },
  Philippines: {
    currency: "PHP",
    serviceCharge: { enabled: false, rate: 0.1 },
    tax: { enabled: true, rate: 0.12 },
  },
  Vietnam: {
    currency: "VND",
    serviceCharge: { enabled: false, rate: 0.05 },
    tax: { enabled: true, rate: 0.08 },
  },
};

const CURRENCY_LABELS: Record<Currency, string> = {
  SGD: "S$",
  MYR: "RM",
  IDR: "Rp",
  THB: "THB",
  PHP: "PHP",
  VND: "VND",
};

const clampPercent = (value: number, min = 0, max = 100) => {
  if (!Number.isFinite(value)) return min;
  return Math.min(Math.max(value, min), max);
};

const roundToTwo = (value: number) => Number(value.toFixed(2));

const redistributePercentages = (persons: Person[]): Person[] => {
  if (!persons.length) return persons;
  const total = persons.reduce((sum, person) => sum + Math.max(person.weight ?? 0, 0), 0);
  if (total <= 0) {
    const equalShare = roundToTwo(100 / persons.length);
    const rounded = persons.map((person) => ({ ...person, weight: equalShare }));
    const diff = roundToTwo(100 - rounded.reduce((sum, person) => sum + person.weight, 0));
    if (Math.abs(diff) > 0.001) {
      rounded[0] = { ...rounded[0], weight: roundToTwo(rounded[0].weight + diff) };
    }
    return rounded;
  }
  const scaled = persons.map((person) => ({
    ...person,
    weight: roundToTwo(((person.weight ?? 0) / total) * 100),
  }));
  const diff = roundToTwo(100 - scaled.reduce((sum, person) => sum + person.weight, 0));
  if (Math.abs(diff) > 0.001) {
    const index = scaled.findIndex((person) => person.weight > 0);
    if (index >= 0) {
      scaled[index] = { ...scaled[index], weight: roundToTwo(scaled[index].weight + diff) };
    }
  }
  return scaled;
};

const setShareForPerson = (persons: Person[], personId: string, percent: number): Person[] => {
  if (!persons.length) return persons;
  const clamped = roundToTwo(clampPercent(percent));
  const normalized = redistributePercentages(persons);
  const others = normalized.filter((person) => person.id !== personId);
  const remaining = roundToTwo(Math.max(0, 100 - clamped));
  const totalOthers = others.reduce((sum, person) => sum + person.weight, 0);

  const updated = normalized.map((person) => {
    if (person.id === personId) {
      return { ...person, weight: clamped };
    }
    if (!others.length) return { ...person, weight: 0 };
    if (totalOthers <= 0) {
      const share = others.length ? remaining / others.length : 0;
      return { ...person, weight: roundToTwo(share) };
    }
    const share = (person.weight / totalOthers) * remaining;
    return { ...person, weight: roundToTwo(share) };
  });

  const diff = roundToTwo(100 - updated.reduce((sum, person) => sum + person.weight, 0));
  if (Math.abs(diff) > 0.001) {
    const index = updated.findIndex((person) => person.id === personId);
    const targetIndex = index >= 0 ? index : updated.findIndex((person) => person.weight > 0);
    if (targetIndex >= 0) {
      updated[targetIndex] = {
        ...updated[targetIndex],
        weight: roundToTwo(Math.max(0, updated[targetIndex].weight + diff)),
      };
    }
  }

  return updated;
};

const mapOcrItemsToEditable = (ocrItems: OcrLineItem[]): Item[] =>
  ocrItems
    .filter((item) => (item.name?.trim() ?? "").length > 0)
    .map((item) => {
      const qty = Number.isFinite(item.qty) && item.qty ? Math.max(1, Math.round(item.qty)) : 1;
      const safeQty = qty > 0 ? qty : 1;
      const lineTotalValue = typeof item.lineTotal === "number" ? item.lineTotal : undefined;
      const unitPriceValue = typeof item.unitPrice === "number" ? item.unitPrice : undefined;
      const computedUnit = typeof lineTotalValue === "number" ? Number((lineTotalValue / safeQty).toFixed(2)) : 0;
      const unit = typeof unitPriceValue === "number" ? Number(unitPriceValue.toFixed(2)) : computedUnit;
      return {
        id: nextId(),
        name: item.name?.trim() ?? "",
        qty: safeQty,
        unitPrice: Number(unit.toFixed(2)),
        assignments: [],
      } satisfies Item;
    });

export const TabsReceiptTotal = () => {
  const [country, setCountry] = useState<Country>("Singapore");
  const [persons, setPersons] = useState<Person[]>(() =>
    redistributePercentages(INITIAL_PERSONS.map((person) => ({ ...person }))),
  );
  const [items, setItems] = useState<Item[]>(INITIAL_ITEMS);
  const [activeTab, setActiveTab] = useState<TabKey>("total");
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [totalIncludesFees, setTotalIncludesFees] = useState(true);
  const [showServiceAndTax, setShowServiceAndTax] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [serviceChargeEnabled, setServiceChargeEnabled] = useState(true);
  const [serviceChargeRate, setServiceChargeRate] = useState(0.1);
  const [taxEnabled, setTaxEnabled] = useState(true);
  const [taxRate, setTaxRate] = useState(0.09);
  const [receiptMeta, setReceiptMeta] = useState<ReceiptMetaState>({});
  const [unitPriceDrafts, setUnitPriceDrafts] = useState<Record<string, string>>({});

  const currency = COUNTRY_SETTINGS[country].currency;
  const currencyLabel = CURRENCY_LABELS[currency];

  useEffect(() => {
    const settings = COUNTRY_SETTINGS[country];
    setServiceChargeEnabled(settings.serviceCharge.enabled);
    setServiceChargeRate(settings.serviceCharge.rate);
    setTaxEnabled(settings.tax.enabled);
    setTaxRate(settings.tax.rate);
  }, [country]);

  useEffect(() => {
    setUnitPriceDrafts((prev) => {
      const next: Record<string, string> = {};
      items.forEach((item) => {
        if (prev[item.id] !== undefined) {
          next[item.id] = prev[item.id];
        } else if (Number.isFinite(item.unitPrice)) {
          next[item.id] = item.unitPrice.toString();
        } else {
          next[item.id] = "";
        }
      });
      return next;
    });
  }, [items]);

  const appliedServiceCharge = serviceChargeEnabled ? serviceChargeRate : 0;
  const appliedTax = taxEnabled ? taxRate : 0;

  const weights = useMemo(() => {
    const map: Record<string, number> = {};
    persons.forEach((person) => {
      const share = clampPercent(person.weight ?? 0, 0, 100);
      map[person.id] = Math.max(share, 0);
    });
    return map;
  }, [persons]);

  const itemsBreakdown = useMemo(
    () =>
      splitItems(items, persons, appliedServiceCharge, appliedTax, {
        mode: "half-up",
        roundToTenCents: false,
        currency,
      }),
    [items, persons, appliedServiceCharge, appliedTax, currency],
  );

  const totalBreakdown = useMemo(() => {
    const options = {
      mode: "half-up" as const,
      roundToTenCents: false,
      currency,
    };
    const baseAmount = Number.isFinite(totalAmount) ? totalAmount : 0;
    const targetTotal = totalIncludesFees
      ? baseAmount
      : forward(baseAmount, appliedServiceCharge, appliedTax, options.mode).total;
    return splitTotal(targetTotal, persons, weights, appliedServiceCharge, appliedTax, options);
  }, [totalAmount, totalIncludesFees, persons, weights, appliedServiceCharge, appliedTax, currency]);

  const totalHelpText = totalIncludesFees
    ? "Enter the bill total after tax and service charge. Adjust weights to split unevenly."
    : "Enter the subtotal before service charge or tax. We'll add them before splitting.";

  const totalWithFees = useMemo(() => {
    if (!Number.isFinite(totalAmount) || !totalAmount) return 0;
    if (totalIncludesFees) return totalAmount;
    return forward(totalAmount, appliedServiceCharge, appliedTax, "half-up").total;
  }, [totalAmount, totalIncludesFees, appliedServiceCharge, appliedTax]);

  const addPerson = () => {
    setPersons((prev) => {
      const normalized = redistributePercentages(prev);
      const newPerson = createPerson(prev.length);
      const newShare = roundToTwo(100 / (normalized.length + 1));
      const remaining = Math.max(0, 100 - newShare);
      const total = normalized.reduce((sum, item) => sum + item.weight, 0) || 1;
      const updatedOthers = normalized.map((person) => ({
        ...person,
        weight: roundToTwo((person.weight / total) * remaining),
      }));
      const updated = [...updatedOthers, { ...newPerson, weight: newShare }];
      return redistributePercentages(updated);
    });
  };

  const renamePerson = (personId: string, name: string) => {
    setPersons((prev) =>
      prev.map((person) => (person.id === personId ? { ...person, name: name.trim() || person.name } : person)),
    );
  };

  const removePerson = (personId: string) => {
    setPersons((prev) => redistributePercentages(prev.filter((person) => person.id !== personId)));
    setItems((prev) =>
      prev.map((item) => ({
        ...item,
        assignments: item.assignments.filter((assignment) => assignment.personId !== personId),
      })),
    );
  };

  const updateWeight = (personId: string, weight: number) => {
    setPersons((prev) => setShareForPerson(prev, personId, weight));
  };

  const addItem = () => {
    setItems((prev) => [...prev, createBlankItem()]);
  };

  const updateItem = (itemId: string, patch: Partial<Item>) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === itemId
          ? { ...item, ...patch, assignments: patch.assignments ?? item.assignments }
          : item,
      ),
    );
  };

  const removeItem = (itemId: string) => {
    setItems((prev) => prev.filter((item) => item.id !== itemId));
  };

  const toggleAssignment = (itemId: string, personId: string) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id !== itemId) return item;
        const exists = item.assignments.some((assignment) => assignment.personId === personId);
        const nextAssignments = exists
          ? item.assignments.filter((assignment) => assignment.personId !== personId)
          : [...item.assignments, { personId }];

        if (!nextAssignments.length) {
          return { ...item, assignments: nextAssignments };
        }

        const totalWeight = nextAssignments.reduce((sum, assignment) => {
          const person = persons.find((candidate) => candidate.id === assignment.personId);
          return sum + Math.max(person?.weight ?? 0, 0);
        }, 0);

        const assignments = nextAssignments.map((assignment) => {
          const person = persons.find((candidate) => candidate.id === assignment.personId);
          const weight = Math.max(person?.weight ?? 0, 0);
          const sharePercent = totalWeight > 0 ? (weight / totalWeight) * 100 : undefined;
          return { personId: assignment.personId, sharePercent } satisfies ItemAssignment;
        });

        return {
          ...item,
          assignments,
        };
      }),
    );
  };

  const assignmentLabel = useCallback(
    (item: Item) => {
      if (!item.assignments.length) return "Assign people";
      const names = persons
        .filter((person) => item.assignments.some((assignment) => assignment.personId === person.id))
        .map((person) => person.name);
      return names.join(", ");
    },
    [persons],
  );

  const applyParsedResult = useCallback(
    (parsed: OcrResult) => {
      setReceiptMeta({
        merchant: parsed.merchant,
        dateISO: parsed.dateISO,
        confidence: parsed.confidenceLabel,
        confidenceScore: parsed.confidenceScore,
      });

      const mappedItems = mapOcrItemsToEditable(parsed.items);
      const itemsToUse = mappedItems.length ? mappedItems : INITIAL_ITEMS.map((item) => ({ ...item, id: nextId() }));
      setItems(itemsToUse);
      setActiveTab("items");

      const itemsTotal = mappedItems.reduce((sum, item) => sum + item.qty * item.unitPrice, 0);
      if (itemsTotal > 0) {
        setTotalAmount(Number(itemsTotal.toFixed(2)));
        setTotalIncludesFees(true);
      } else {
        setTotalAmount(0);
      }

      const settings = COUNTRY_SETTINGS[country];
      setServiceChargeEnabled(settings.serviceCharge.enabled);
      setServiceChargeRate(settings.serviceCharge.rate);
      setTaxEnabled(settings.tax.enabled);
      setTaxRate(settings.tax.rate);
      setShowServiceAndTax(false);
    },
    [country],
  );

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-6 pb-12">
        <div className="flex flex-col gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Image src="/logo-split4me.svg" alt="Split4me" width={36} height={36} priority className="rounded-full" />
              <h1 className="text-xl font-semibold">Split4me</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Add your friends, then record each item or enter the grand total to see what everyone owes.
            </p>
            {receiptMeta.merchant || receiptMeta.dateISO ? (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                {receiptMeta.merchant ? <span>Merchant: {receiptMeta.merchant}</span> : null}
                {receiptMeta.dateISO ? <span>Date: {new Date(receiptMeta.dateISO).toLocaleString()}</span> : null}
                {receiptMeta.confidence ? <span>OCR confidence: {receiptMeta.confidence}</span> : null}
              </div>
            ) : null}
          </div>
          <div className="flex w-full items-center gap-3 sm:w-auto">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">Country</Label>
            <Select value={country} onValueChange={(value) => setCountry(value as Country)}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent align="start">
                <SelectItem value="Singapore">Singapore</SelectItem>
                <SelectItem value="Malaysia">Malaysia</SelectItem>
                <SelectItem value="Indonesia">Indonesia</SelectItem>
                <SelectItem value="Thailand">Thailand</SelectItem>
                <SelectItem value="Philippines">Philippines</SelectItem>
                <SelectItem value="Vietnam">Vietnam</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-start justify-between gap-4">
            <div>
              <CardTitle className="text-red-600">Service charge & tax</CardTitle>
              {!showServiceAndTax ? (
                <p className="mt-2 text-sm text-muted-foreground">
                  Toggle these on if the bill includes service charge or tax.
                </p>
              ) : null}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowServiceAndTax((prev) => !prev)}
              aria-expanded={showServiceAndTax}
              className="flex items-center gap-1 text-muted-foreground"
            >
              {showServiceAndTax ? "Hide" : "Show"}
              <ChevronDown className={`h-4 w-4 transition-transform ${showServiceAndTax ? "rotate-180" : ""}`} />
            </Button>
          </CardHeader>
          {showServiceAndTax ? (
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Service charge</p>
                      <p className="text-xs text-muted-foreground">Default 10% in Singapore. Set to 0 if none.</p>
                    </div>
                    <Switch checked={serviceChargeEnabled} onCheckedChange={setServiceChargeEnabled} />
                  </div>
                  <div className="mt-3">
                    <Label htmlFor="service-charge">Rate (%)</Label>
                    <div className="relative mt-1">
                      <Input
                        id="service-charge"
                        type="number"
                        min={0}
                        step="0.1"
                        value={(serviceChargeRate * 100).toString()}
                        onChange={(event) => setServiceChargeRate(Number.parseFloat(event.target.value || "0") / 100)}
                        disabled={!serviceChargeEnabled}
                        className="pr-10"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-medium">Tax</p>
                      <p className="text-xs text-muted-foreground">Default GST 9% (SG) or SST 6% (MY). Adjust for your bill.</p>
                    </div>
                    <Switch checked={taxEnabled} onCheckedChange={setTaxEnabled} />
                  </div>
                  <div className="mt-3">
                    <Label htmlFor="tax-rate">Rate (%)</Label>
                    <div className="relative mt-1">
                      <Input
                        id="tax-rate"
                        type="number"
                        min={0}
                        step="0.1"
                        value={(taxRate * 100).toString()}
                        onChange={(event) => setTaxRate(Number.parseFloat(event.target.value || "0") / 100)}
                        disabled={!taxEnabled}
                        className="pr-10"
                      />
                      <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          ) : null}
        </Card>

      <PeopleAssign
        persons={persons}
        onAdd={addPerson}
        onRename={renamePerson}
        onRemove={removePerson}
        onWeightChange={updateWeight}
        showWeights={showWeights}
        onToggleWeights={() => setShowWeights((prev) => !prev)}
        canEditWeights={activeTab === "total"}
      />

      <ReceiptOcrPanel onReceiptParsed={applyParsedResult} />

      <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as TabKey)}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="total">Total only</TabsTrigger>
            <TabsTrigger value="items">Items</TabsTrigger>
          </TabsList>

          <TabsContent value="items" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Item entries</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Fill in item name, quantity, and unit price. Use “Assigned to” to choose who shares each row.
                </p>
                <div className="flex items-center justify-end gap-2">
                  <Button variant="ghost" onClick={() => setItems(INITIAL_ITEMS.map((item) => ({ ...item, id: nextId() })))}>
                    Reset items
                  </Button>
                  <Button onClick={addItem}>Add item</Button>
                </div>
                <div className="overflow-x-auto rounded-xl border">
                  <Table className="min-w-[640px]">
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-64">Item</TableHead>
                        <TableHead className="w-24">Qty</TableHead>
                        <TableHead className="w-32">Unit price ({currencyLabel})</TableHead>
                        <TableHead>Total ({currencyLabel})</TableHead>
                        <TableHead>Assigned to</TableHead>
                        <TableHead className="w-12" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {items.map((item) => {
                        const lineTotal = Number.isFinite(item.qty * item.unitPrice) ? item.qty * item.unitPrice : 0;
                        return (
                          <TableRow key={item.id}>
                            <TableCell>
                              <Input
                                value={item.name}
                                onChange={(event) =>
                                  updateItem(item.id, {
                                    name: event.target.value,
                                  })
                                }
                                placeholder="Item name"
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                min={1}
                                value={Number.isFinite(item.qty) ? item.qty.toString() : ""}
                                onChange={(event) =>
                                  updateItem(item.id, {
                                    qty: Math.max(1, Number.parseInt(event.target.value || "1", 10)),
                                  })
                                }
                              />
                            </TableCell>
                            <TableCell>
                              <Input
                                type="text"
                                inputMode="decimal"
                                value={unitPriceDrafts[item.id] ?? (Number.isFinite(item.unitPrice) ? item.unitPrice.toString() : "")}
                                onChange={(event) => {
                                  const nextValue = event.target.value;
                                  setUnitPriceDrafts((prev) => ({ ...prev, [item.id]: nextValue }));
                                  const numeric = Number.parseFloat(nextValue);
                                  if (!Number.isNaN(numeric)) {
                                    updateItem(item.id, {
                                      unitPrice: numeric,
                                    });
                                  }
                                }}
                                onBlur={() => {
                                  const draft = unitPriceDrafts[item.id];
                                  const numeric = Number.parseFloat(draft ?? "");
                                  setUnitPriceDrafts((prev) => ({
                                    ...prev,
                                    [item.id]: Number.isFinite(numeric) ? numeric.toFixed(2) : "",
                                  }));
                                }}
                              />
                            </TableCell>
                            <TableCell className="font-mono text-sm">{lineTotal ? `${lineTotal.toFixed(2)} ${currencyLabel}` : "0.00"}</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-2">
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="outline" size="sm" className="justify-start gap-2">
                                      <Users className="h-4 w-4" />
                                      {assignmentLabel(item)}
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent className="w-60" align="start" side="bottom" sideOffset={4}>
                                    <DropdownMenuLabel>Assign people to this item</DropdownMenuLabel>
                                    <DropdownMenuSeparator />
                                    {persons.map((person) => {
                                      const isAssigned = item.assignments.some((assignment) => assignment.personId === person.id);
                                      return (
                                        <DropdownMenuCheckboxItem
                                          key={person.id}
                                          checked={isAssigned}
                                          onCheckedChange={() => toggleAssignment(item.id, person.id)}
                                          className="flex items-center gap-2 text-sm"
                                        >
                                          <span
                                            aria-hidden
                                            className="h-2 w-2 rounded-full"
                                            style={{ backgroundColor: person.color }}
                                          />
                                          {person.name}
                                        </DropdownMenuCheckboxItem>
                                      );
                                    })}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="total" className="mt-4 space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Final total</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">{totalHelpText}</p>
                <div className="space-y-2">
                  <Label htmlFor="grand-total">Amount to split ({currencyLabel})</Label>
                  <Input
                    id="grand-total"
                    type="number"
                    inputMode="decimal"
                    min={0}
                    value={totalAmount ? totalAmount.toString() : ""}
                    onChange={(event) => setTotalAmount(Number.parseFloat(event.target.value || "0"))}
                    placeholder="Enter the final amount paid"
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-lg border border-border px-3 py-2">
                  <div className="space-y-1">
                    <Label htmlFor="total-includes-fees" className="text-sm font-medium">
                      Amount includes service charge & tax
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Toggle off if you entered the subtotal before fees.
                    </p>
                  </div>
                  <Switch id="total-includes-fees" checked={totalIncludesFees} onCheckedChange={setTotalIncludesFees} />
                </div>
                {!totalIncludesFees && totalWithFees > 0 ? (
                  <p className="text-xs text-muted-foreground">
                    We&apos;ll split {currencyLabel} {totalWithFees.toFixed(2)} after adding service charge and tax.
                  </p>
                ) : null}
                <p className="text-xs text-muted-foreground">
                  Percentage split uses the values under “Percentage split” in the people list. Leave shares equal for an even split.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      <ResultsBar activeTab={activeTab} itemsBreakdown={itemsBreakdown} totalBreakdown={totalBreakdown} persons={persons} />
    </div>
  );
};
