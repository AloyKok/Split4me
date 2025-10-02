import type { Currency, Person, SplitBreakdown } from "@/types";

const currencySymbols: Record<Currency, string> = {
  SGD: "S$",
  MYR: "RM",
  IDR: "Rp",
  THB: "THB",
  PHP: "PHP",
  VND: "VND",
};

const locales: Record<Currency, string> = {
  SGD: "en-SG",
  MYR: "en-MY",
  IDR: "id-ID",
  THB: "th-TH",
  PHP: "en-PH",
  VND: "vi-VN",
};

export const formatCurrency = (value: number, currency: Currency) => {
  const formatter = new Intl.NumberFormat(locales[currency], {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return formatter.format(value);
};

export const plainCurrency = (value: number, currency: Currency) =>
  `${currencySymbols[currency]}${value.toFixed(2)}`;

export const formatWhatsApp = (
  breakdown: SplitBreakdown,
  persons: Person[],
) => {
  const personMap = new Map(persons.map((person) => [person.id, person.name]));
  const lines = breakdown.perPerson.map((share) => {
    const name = personMap.get(share.personId) ?? "Friend";
    return `${name}: ${plainCurrency(share.total, breakdown.currency)}`;
  });
  return lines.join("\n");
};

export const formatPercentage = (value: number) => `${(value * 100).toFixed(1)}%`;
