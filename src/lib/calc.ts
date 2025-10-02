import { roundBankers, roundHalfUp, distributeRemainder } from "@/lib/rounding";
import type { SplitBreakdown } from "@/types";

export type RoundingMode = "half-up" | "bankers";

const pickRounder = (mode: RoundingMode) =>
  mode === "bankers" ? roundBankers : roundHalfUp;

export interface ForwardResult {
  before: number;
  serviceCharge: number;
  tax: number;
  total: number;
}

export type ReverseResult = ForwardResult;

export const forward = (
  beforeCharge: number,
  scRate: number,
  taxRate: number,
  mode: RoundingMode,
): ForwardResult => {
  const round = pickRounder(mode);
  const scRaw = beforeCharge * scRate;
  const taxRaw = (beforeCharge + scRaw) * taxRate;
  const serviceCharge = round(scRaw);
  const tax = round(taxRaw);
  const total = round(beforeCharge + serviceCharge + tax);
  const adjusted = distributeRemainder([serviceCharge, tax], total - round(beforeCharge));
  return {
    before: round(beforeCharge),
    serviceCharge: adjusted[0] ?? serviceCharge,
    tax: adjusted[1] ?? tax,
    total,
  };
};

export const reverse = (
  total: number,
  scRate: number,
  taxRate: number,
  mode: RoundingMode,
): ReverseResult => {
  const round = pickRounder(mode);
  const before = scRate > 0 ? total / ((1 + scRate) * (1 + taxRate)) : total / (1 + taxRate);
  const scRaw = before * scRate;
  const taxRaw = (before + scRaw) * taxRate;
  const beforeRounded = round(before);
  const serviceCharge = round(scRaw);
  const tax = round(taxRaw);
  const adjusted = distributeRemainder([serviceCharge, tax], round(total) - beforeRounded);
  return {
    before: beforeRounded,
    serviceCharge: adjusted[0] ?? serviceCharge,
    tax: adjusted[1] ?? tax,
    total: round(total),
  };
};

export const toSplitBreakdown = (
  result: ReverseResult,
  currency: SplitBreakdown["currency"],
  perPerson: SplitBreakdown["perPerson"],
): SplitBreakdown => ({
  currency,
  beforeCharge: result.before,
  serviceChargeTotal: result.serviceCharge,
  taxTotal: result.tax,
  grandTotal: result.total,
  perPerson,
});
