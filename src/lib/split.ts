import { reverse, type RoundingMode } from "@/lib/calc";
import { distributeRemainder, roundBankers, roundHalfUp, roundToNearestStep } from "@/lib/rounding";
import type { Currency, Item, ItemAssignment, Person, PersonShare, SplitBreakdown } from "@/types";

const EPSILON = 1e-9;

/**
 * If your rounders take (value) only, replace pickRound with `const rounding = (v:number)=> (options.mode==='bankers'? roundBankers(v): roundHalfUp(v));`
 * and also drop the `precision` parameters passed into distributeRemainder below (or make DR infer from currency).
 */
const pickRound = (mode: RoundingMode, decimals: number) =>
  (mode === "bankers"
    ? (value: number) => roundBankers(value, decimals)
    : (value: number) => roundHalfUp(value, decimals));

const sum = (values: number[]) => values.reduce((acc, value) => acc + value, 0);
const computeLineTotal = (item: Item) => (item.qty || 0) * (item.unitPrice || 0);

/** Derive decimal places from step (e.g., 0.1 → 1, 0.05 → 2, 1 → 0). */
const decimalsFromStep = (step: number) => {
  if (step <= 0) return 2;
  // Handle common fractional steps robustly (0.1, 0.05, 0.25, etc.)
  const log10 = Math.log10(step);
  // If step is not a power of 10, fall back to safe 2 decimals or compute from string
  if (!Number.isFinite(log10) || Math.abs(Math.round(log10) - log10) > 1e-9) {
    // Fallback: count decimals from string to handle 0.05, 0.25, etc.
    const s = step.toString();
    const dot = s.indexOf(".");
    return dot === -1 ? 0 : (s.length - dot - 1);
  }
  return Math.max(0, -Math.round(log10));
};

export interface SplitOptions {
  mode: RoundingMode;
  roundToTenCents: boolean;
  currency: Currency; // expecting currency.minorUnit (e.g., 0 for JPY, 2 for USD, 3 for KWD)
}

const applyStepReconciliation = (
  totals: number[],
  targetRoundedToCurrency: number,
  rounding: (value: number) => number,
  step?: number,
  currencyDecimals?: number,
) => {
  if (!step) {
    // No step: reconcile to the currency-rounded target using currency precision
    return distributeRemainder(totals, targetRoundedToCurrency, currencyDecimals ?? 2);
  }

  // Step provided: step-round both the components and the target, then reconcile at step precision
  const precision = decimalsFromStep(step);
  const stepped = totals.map((v) => roundToNearestStep(v, step));
  const targetStepped = roundToNearestStep(targetRoundedToCurrency, step);
  return distributeRemainder(stepped, targetStepped, precision);
};

export const splitItems = (
  items: Item[],
  persons: Person[],
  serviceChargeRate: number,
  taxRate: number,
  options: SplitOptions,
): SplitBreakdown => {
  const currencyDecimals = 2;
  const rounding = pickRound(options.mode, currencyDecimals);

  // 1) Item totals
  const itemTotals = items.map(computeLineTotal);
  const itemsTotal = sum(itemTotals);

  // 2) Build baseShares per person from assignments; collect unassigned into proportional pool
  const personIndex = new Map(persons.map((person, index) => [person.id, index]));
  const baseShares = persons.map(() => 0);
  let unassignedTotal = 0;

  const personWeights = persons.map((p) => Math.max(p.weight ?? 0, 0));
  const totalWeight = sum(personWeights);
  const fallbackWeight = persons.length ? 1 / persons.length : 0;

  items.forEach((item, itemIndex) => {
    const lineTotal = itemTotals[itemIndex];
    if (lineTotal <= 0) return;
    const assignees: ItemAssignment[] = item.assignments || [];
    if (!assignees.length) {
      unassignedTotal += lineTotal;
      return;
    }

    const percentSum = assignees.reduce(
      (acc, a) => acc + Math.max(a.sharePercent ?? 0, 0),
      0,
    );
    const usePercent = percentSum > EPSILON;
    const evenShare = assignees.length ? 1 / assignees.length : 0;

    assignees.forEach((assignment) => {
      const index = personIndex.get(assignment.personId);
      if (index === undefined) return;
      const weight = usePercent
        ? Math.max(assignment.sharePercent ?? 0, 0) / percentSum
        : evenShare;
      baseShares[index] += lineTotal * weight;
    });
  });

  if (unassignedTotal > 0 && persons.length) {
    persons.forEach((_person, index) => {
      const weight = totalWeight > EPSILON ? personWeights[index] / totalWeight : fallbackWeight;
      baseShares[index] += unassignedTotal * weight;
    });
  }

  // 3) Charges on raw bases
  const serviceChargeTotal = itemsTotal * serviceChargeRate;
  const taxTotal = (itemsTotal + serviceChargeTotal) * taxRate;

  // 4) Reconcile items per person to currency-rounded itemsTotal
  //    Use RAW baseShares for fair penny distribution; DR will do the rounding to target.
  const itemsRounded = distributeRemainder(baseShares, rounding(itemsTotal), currencyDecimals);

  // 5) Service charge: allocate from RAW proportions (baseShares), then reconcile to SC total
  const scRaw = itemsTotal > EPSILON
    ? baseShares.map((v) => (v / itemsTotal) * serviceChargeTotal)
    : persons.map(() => 0);
  const scRounded = distributeRemainder(scRaw, rounding(serviceChargeTotal), currencyDecimals);

  // 6) Tax: allocate from RAW tax base (items + scRaw), then reconcile to tax total
  const taxBaseRaw = baseShares.map((v, i) => v + scRaw[i]);
  const taxRaw = taxBaseRaw.map((v) => v * taxRate);
  const taxRounded = distributeRemainder(taxRaw, rounding(taxTotal), currencyDecimals);

  // 7) Build pre-step totals and apply optional step reconciliation (e.g., 10-cent rounding)
  const totalsBeforeStep = persons.map((_, i) => (itemsRounded[i] ?? 0) + (scRounded[i] ?? 0) + (taxRounded[i] ?? 0));
  const grandRaw = itemsTotal + serviceChargeTotal + taxTotal;
  const grandTargetCurrency = rounding(grandRaw);

  const step = options.roundToTenCents ? 0.1 : undefined;
  const reconciledTotals = applyStepReconciliation(
    totalsBeforeStep,
    grandTargetCurrency,
    rounding,
    step,
    currencyDecimals,
  );

  // 8) Ensure components sum to final total per person — push step delta into `tax` (or use an explicit `adjustment`)
  const deltas = reconciledTotals.map((t, i) => t - totalsBeforeStep[i]);

  const perPerson: PersonShare[] = persons.map((person, index) => {
    const items = itemsRounded[index] ?? 0;
    const serviceCharge = scRounded[index] ?? 0;
    const tax = (taxRounded[index] ?? 0) + (deltas[index] ?? 0);
    const total = reconciledTotals[index] ?? 0;

    // Clean up negative zero artifacts
    const fixNegZero = (n: number) => (Object.is(n, -0) ? 0 : n);

    return {
      personId: person.id,
      items: fixNegZero(items),
      serviceCharge: fixNegZero(serviceCharge),
      tax: fixNegZero(tax),
      total: fixNegZero(total),
    };
  });

  return {
    currency: options.currency,
    beforeCharge: rounding(itemsTotal),
    serviceChargeTotal: rounding(serviceChargeTotal),
    taxTotal: rounding(taxTotal),
    grandTotal: rounding(grandRaw),
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
  const currencyDecimals = 2;
  const rounding = pickRound(options.mode, currencyDecimals);

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

  // 1) Fractional split of the provided total
  const weightValues = persons.map((p) => Math.max(weights[p.id] ?? 0, 0));
  const totalWeight = sum(weightValues);
  const fractions = totalWeight > EPSILON
    ? weightValues.map((v) => v / totalWeight)
    : persons.map(() => 1 / persons.length);

  const totalsRaw = fractions.map((f) => total * f);
  const totals = distributeRemainder(totalsRaw, rounding(total), currencyDecimals);

  // 2) Reverse each person's total into components (before, serviceCharge, tax, total)
  const perPersonShares = totals.map((value) => reverse(value, serviceChargeRate, taxRate, options.mode));

  // 3) Build perPerson
  const perPerson: PersonShare[] = persons.map((person, index) => {
    const shares = perPersonShares[index];
    const items = shares?.before ?? 0;
    const serviceCharge = shares?.serviceCharge ?? 0;
    const tax = shares?.tax ?? 0;
    const t = shares?.total ?? 0;

    const fixNegZero = (n: number) => (Object.is(n, -0) ? 0 : n);

    return {
      personId: person.id,
      items: fixNegZero(items),
      serviceCharge: fixNegZero(serviceCharge),
      tax: fixNegZero(tax),
      total: fixNegZero(t),
    };
  });

  // 4) Optional step reconciliation so splitTotal behaves like splitItems
  const step = options.roundToTenCents ? 0.1 : undefined;
  if (step) {
    const currentTotals = perPerson.map((p) => p.total);
    const reconciled = applyStepReconciliation(
      currentTotals,
      rounding(total),
      rounding,
      step,
      currencyDecimals,
    );
    const deltas = reconciled.map((t, i) => t - currentTotals[i]);
    perPerson.forEach((p, i) => {
      p.tax += deltas[i];  // fold delta into tax
      p.total = reconciled[i];
    });
  }

  // 5) Aggregate, rounded to currency
  const beforeCharge = perPerson.reduce((s, p) => s + p.items, 0);
  const serviceChargeTotal = perPerson.reduce((s, p) => s + p.serviceCharge, 0);
  const taxTotal = perPerson.reduce((s, p) => s + p.tax, 0);
  const grandTotal = perPerson.reduce((s, p) => s + p.total, 0);

  return {
    currency: options.currency,
    beforeCharge: rounding(beforeCharge),
    serviceChargeTotal: rounding(serviceChargeTotal),
    taxTotal: rounding(taxTotal),
    grandTotal: rounding(grandTotal),
    perPerson,
  };
};
