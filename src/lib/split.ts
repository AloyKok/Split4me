import { reverse, type RoundingMode } from "@/lib/calc";
import { distributeRemainder, roundBankers, roundHalfUp, roundToNearestStep } from "@/lib/rounding";
import type { Currency, Item, ItemAssignment, Person, PersonShare, SplitBreakdown } from "@/types";

const EPSILON = 1e-9;

const picker = (mode: RoundingMode) => (mode === "bankers" ? roundBankers : roundHalfUp);

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);

const assignDefault = (items: Item[], persons: Person[]) =>
  items.map((item) =>
    item.assignments.length
      ? item
      : {
          ...item,
          assignments: persons.map((person) => ({ personId: person.id })),
        },
  );

const computeLineTotal = (item: Item) => (item.qty || 0) * (item.unitPrice || 0);

export interface SplitOptions {
  mode: RoundingMode;
  roundToTenCents: boolean;
  currency: Currency;
}

const applyStepReconciliation = (
  totals: number[],
  target: number,
  rounding: (value: number) => number,
  step?: number,
) => {
  if (!step) return distributeRemainder(totals.map(rounding), target);
  const stepped = totals.map((value) => rounding(roundToNearestStep(value, step)));
  return distributeRemainder(stepped, target, step >= 1 ? 0 : 2);
};

export const splitItems = (
  items: Item[],
  persons: Person[],
  serviceChargeRate: number,
  taxRate: number,
  options: SplitOptions,
): SplitBreakdown => {
  const rounding = picker(options.mode);
  const enriched = assignDefault(items, persons);
  const itemTotals = enriched.map(computeLineTotal);
  const itemsTotal = sum(itemTotals);

  const personIndex = new Map(persons.map((person, index) => [person.id, index]));
  const itemShares = persons.map(() => 0);

  enriched.forEach((item, itemIndex) => {
    const lineTotal = itemTotals[itemIndex];
    if (lineTotal <= 0) return;
    const assignees: ItemAssignment[] = item.assignments;
    const withPercent = assignees.some((assignment) => typeof assignment.sharePercent === "number");
    const percentSum = withPercent
      ? assignees.reduce((acc, assignment) => acc + (assignment.sharePercent ?? 0), 0)
      : assignees.length;

    assignees.forEach((assignment) => {
      const index = personIndex.get(assignment.personId);
      if (index === undefined) return;
      const weight = withPercent
        ? (assignment.sharePercent ?? 0) / (percentSum || 1)
        : 1 / (percentSum || 1);
      itemShares[index] += lineTotal * weight;
    });
  });

  const serviceChargeTotal = itemsTotal * serviceChargeRate;
  const taxTotal = (itemsTotal + serviceChargeTotal) * taxRate;

  const itemsRounded = distributeRemainder(itemShares.map(rounding), rounding(itemsTotal));
  const scRounded = itemsTotal > EPSILON
    ? distributeRemainder(
        itemShares.map((value) => rounding((value / itemsTotal) * serviceChargeTotal)),
        rounding(serviceChargeTotal),
      )
    : persons.map(() => 0);
  const taxRounded = distributeRemainder(
    itemsRounded.map((value, index) => rounding((value + scRounded[index]) * taxRate)),
    rounding(taxTotal),
  );

  const totals = itemsRounded.map((value, index) => value + scRounded[index] + taxRounded[index]);
  const reconciledTotals = applyStepReconciliation(
    totals,
    rounding(itemsTotal + serviceChargeTotal + taxTotal),
    rounding,
    options.roundToTenCents ? 0.1 : undefined,
  );

  const perPerson: PersonShare[] = persons.map((person, index) => ({
    personId: person.id,
    items: itemsRounded[index] ?? 0,
    serviceCharge: scRounded[index] ?? 0,
    tax: taxRounded[index] ?? 0,
    total: reconciledTotals[index] ?? 0,
  }));

  return {
    currency: options.currency,
    beforeCharge: rounding(itemsTotal),
    serviceChargeTotal: rounding(serviceChargeTotal),
    taxTotal: rounding(taxTotal),
    grandTotal: rounding(itemsTotal + serviceChargeTotal + taxTotal),
    perPerson,
  };
};

export const splitTotal = (
  total: number,
  persons: Person[],
  weights: Record<string, number>,
  serviceChargeRate: number,
  taxRate: number,
  options: SplitOptions,
): SplitBreakdown => {
  const rounding = picker(options.mode);
  if (!persons.length) {
    return {
      currency: options.currency,
      beforeCharge: 0,
      serviceChargeTotal: 0,
      taxTotal: 0,
      grandTotal: 0,
      perPerson: [],
    };
  }

  const weightValues = persons.map((person) => Math.max(weights[person.id] ?? 0, 0));
  const totalWeight = sum(weightValues);
  const fractions = totalWeight > EPSILON
    ? weightValues.map((value) => value / totalWeight)
    : persons.map(() => 1 / persons.length);

  const totalsRaw = fractions.map((fraction) => total * fraction);
  const totals = distributeRemainder(totalsRaw, total);

  const perPersonShares = totals.map((value) => reverse(value, serviceChargeRate, taxRate, options.mode));

  const perPerson: PersonShare[] = persons.map((person, index) => ({
    personId: person.id,
    items: perPersonShares[index]?.before ?? 0,
    serviceCharge: perPersonShares[index]?.serviceCharge ?? 0,
    tax: perPersonShares[index]?.tax ?? 0,
    total: perPersonShares[index]?.total ?? 0,
  }));

  const beforeCharge = perPerson.reduce((sum, share) => sum + share.items, 0);
  const serviceChargeTotal = perPerson.reduce((sum, share) => sum + share.serviceCharge, 0);
  const taxTotal = perPerson.reduce((sum, share) => sum + share.tax, 0);
  const grandTotal = perPerson.reduce((sum, share) => sum + share.total, 0);

  return {
    currency: options.currency,
    beforeCharge: rounding(beforeCharge),
    serviceChargeTotal: rounding(serviceChargeTotal),
    taxTotal: rounding(taxTotal),
    grandTotal: rounding(grandTotal),
    perPerson,
  };
};
