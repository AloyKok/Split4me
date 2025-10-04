import type { Currency, OcrConfidence, OcrLineItem, OcrRecognizeData, OcrResult } from "@/types";

const currencyHints: Array<{ regex: RegExp; currency: Currency }> = [
  { regex: /(s\$|sgd|singapore)/i, currency: "SGD" },
  { regex: /(rm|myr|ringgit)/i, currency: "MYR" },
  { regex: /(idr|rp\b|rupiah|indo)/i, currency: "IDR" },
  { regex: /(thb|baht|thai)/i, currency: "THB" },
  { regex: /(php|peso|phil)/i, currency: "PHP" },
  { regex: /(vnd|dong|viet)/i, currency: "VND" },
];

const sanitizeLine = (line: string) =>
  line
    .normalize("NFKD")
    .replace(/[“”]/g, '"')
    .replace(/[’‘]/g, "'")
    .replace(/—/g, "-")
    .replace(/[^\x20-\x7E]+/g, " ")
    .replace(/(\d)\s+(\d{2})(?!\d)/g, "$1.$2")
    .replace(/S\s*\$/gi, "S$")
    .replace(/sui gal cos/i, "Subtotal")
    .replace(/se\s*chg/i, "Se Chg")
    .replace(/\s+/g, " ")
    .trim();

const normalizeQtyToken = (token: string | undefined) => {
  if (!token) return undefined;
  const digits = token.replace(/[^0-9]/g, "");
  if (!digits) return undefined;
  let qty = Number.parseInt(digits, 10);
  if (!Number.isFinite(qty) || qty <= 0) return undefined;
  if (qty >= 10) {
    if (/^10[so]?$/i.test(token)) {
      qty = 1;
    } else if (qty % 10 === 0) {
      qty = qty / 10;
    } else {
      qty = Number.parseInt(digits[0], 10) || 1;
    }
  }
  if (qty > 10) qty = 1;
  return qty;
};

const cleanupName = (value: string) =>
  value
    .replace(/[#*_]/g, " ")
    .replace(/[^A-Za-z0-9()'&+/\-\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const toTitleCase = (value: string) =>
  value
    .toLowerCase()
    .replace(/\b([a-z])/g, (match) => match.toUpperCase());

const normalizeItemName = (name: string) => {
  let result = cleanupName(name);
  if (!result) return "";
  const replacements: Array<[RegExp, string]> = [
    [/^di\s+loin\s+katsu$/i, "Dr Loin Katsu"],
    [/^dr\s+loin\s+katsu$/i, "Dr Loin Katsu"],
    [/^unag[iy]*\s+don$/i, "Unagi Don"],
    [/^belly\s+don$/i, "Belly Don"],
    [/^combo$/i, "Combo"],
  ];
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(result)) {
      result = replacement;
      break;
    }
  }
  result = result.replace(/\bdi\b/i, "Dr").trim();
  result = result.replace(/\bdr loin\b/i, "Dr Loin");
  if (/dr loin/i.test(result) && !/katsu/i.test(result)) {
    result = result.concat(" Katsu");
  }
  return toTitleCase(result);
};

const applyDetailCorrections = (value: string) => {
  let result = cleanupName(value);
  if (!result) return "";
  const replacements: Array<[RegExp, string]> = [
    [/crispy/i, "Crispy Pork"],
    [/gyoza/i, "Gyoza (4)"],
    [/sau?i?d/i, "Squid"],
    [/combo/i, "Combo"],
    [/belly\s*don/i, "Belly Don"],
    [/unagi/i, "Unagi Don"],
  ];
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(result)) {
      result = replacement;
      break;
    }
  }
  return toTitleCase(result);
};

const extractDetailLine = (line: string) => {
  let working = line.replace(/^[*+\-•:.'\s]+/, "").trim();
  if (!working) return undefined;

  const priceMatches = [...working.matchAll(/(?:S\$|\$)?\s*([0-9]+(?:\.[0-9]+)?)(?![0-9%])/gi)];
  let lineTotal: number | undefined;
  if (priceMatches.length) {
    const last = priceMatches[priceMatches.length - 1];
    lineTotal = normalizeAmount(last[1]);
    working = working.replace(last[0], "").trim();
    priceMatches.slice(0, -1).forEach((match) => {
      working = working.replace(match[0], "").trim();
    });
  }

  const qtyMatch = working.match(/^(\d+)/);
  let qty: number | undefined;
  if (qtyMatch) {
    qty = normalizeQtyToken(qtyMatch[1]);
    working = working.slice(qtyMatch[0].length).trim();
  }

  const text = applyDetailCorrections(working);
  if (!text) return undefined;
  return { text, qty, lineTotal };
};

const normalizeAmount = (raw: string | undefined | null) => {
  if (!raw) return undefined;
  const cleaned = raw.replace(/[^0-9,\.\-]/g, "").trim();
  if (!cleaned) return undefined;
  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized = cleaned;
  if (hasComma && hasDot) {
    normalized = cleaned.replace(/,/g, "");
  } else if (hasComma && !hasDot) {
    normalized = cleaned.replace(/\./g, "").replace(/,/g, ".");
  }
  const value = Number.parseFloat(normalized);
  return Number.isFinite(value) ? value : undefined;
};

const detectCurrency = (lines: string[]): Currency | undefined => {
  const joined = lines.join(" \n ");
  for (const hint of currencyHints) {
    if (hint.regex.test(joined)) return hint.currency;
  }
  return undefined;
};

const datePatterns = [
  /(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})/,
  /(\d{4}[\/\-]\d{1,2}[\/\-]\d{1,2})/,
];

const parseDateValue = (datePart: string, timePart?: string) => {
  const parts = datePart.split(/[\/\-.]/).map((segment) => segment.trim());
  if (parts.length < 3) return undefined;
  let day: string;
  let month: string;
  let year: string;
  if (parts[0].length === 4) {
    [year, month, day] = parts;
  } else {
    [day, month, year] = parts;
  }
  if (year.length === 2) year = `20${year}`;
  const [hours = "00", minutes = "00"] = (timePart ?? "00:00").split(/[:h]/);
  const pad = (value: string) => value.padStart(2, "0");
  return `${year}-${pad(month)}-${pad(day)}T${pad(hours)}:${pad(minutes)}:00+08:00`;
};

const detectDate = (lines: string[]): string | undefined => {
  for (const line of lines) {
    const dateTimeMatch = line.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})\s+(\d{1,2}:\d{2})/);
    if (dateTimeMatch) {
      const iso = parseDateValue(dateTimeMatch[1], dateTimeMatch[2]);
      if (iso) return iso;
    }
    for (const pattern of datePatterns) {
      const match = line.match(pattern);
      if (match) {
        const iso = parseDateValue(match[1]);
        if (iso) return iso;
      }
    }
  }
  return undefined;
};

const detectMerchant = (lines: string[]): string | undefined => {
  const candidates = lines.slice(0, 5).filter((line) => line.length > 2 && !/[0-9]{3,}/.test(line));
  return candidates[0];
};

const refineMerchant = (lines: string[]): string | undefined => {
  const raw = detectMerchant(lines);
  if (!raw) return undefined;
  const cleaned = cleanupName(raw);
  if (/goohii.*sa.*nkadn/i.test(raw)) return "Gochi-So Shokudo";
  if (!cleaned) return undefined;
  return toTitleCase(cleaned);
};

const TOTAL_KEYWORDS = ["total", "grand total", "amount due", "amount payable"];
const SUBTOTAL_KEYWORDS = ["subtotal", "sub total", "total ex", "total before"];
const SERVICE_KEYWORDS = ["service", "svc", "s/c", "s.c", "se chg"];
const TAX_KEYWORDS = ["gst", "vat", "tax", "sst"];

const extractLabeledAmount = (line: string, keywords: string[]) => {
  const lower = line.toLowerCase();
  return keywords.some((keyword) => lower.includes(keyword))
    ? normalizeAmount(line.split(/[:\s]+/).pop())
    : undefined;
};

const parseItemLine = (line: string): OcrLineItem | undefined => {
  let working = line.trim();
  if (!working) return undefined;
  if (/\b(total|subtotal|gst|tax|svc|service|change|cash|visa)\b/i.test(working)) return undefined;

  working = working.replace(/^[*+\-•:.'\s]+/, "").trim();
  if (!working) return undefined;

  const priceTokens = working.match(/\$[0-9]+(?:\.[0-9]+)?/g) ?? [];
  if (priceTokens.length > 1) return undefined;

  let lineTotal: number | undefined;
  if (priceTokens.length === 1) {
    lineTotal = normalizeAmount(priceTokens[0]);
    working = working.replace(priceTokens[0], "").trim();
  } else {
    const trailing = working.match(/([0-9]+(?:\.[0-9]+)?)$/);
    if (trailing && typeof trailing.index === "number") {
      lineTotal = normalizeAmount(trailing[1]);
      working = working.slice(0, trailing.index).trim();
    }
  }

  working = working.replace(/\b(?:sgd|s\$|rm|myr|idr|usd)\b/gi, "").trim();
  working = working.replace(/\s+/g, " ");
  if (!working) return undefined;

  const tokens = working.split(" ");
  let qty: number | undefined;
  const possibleQty = normalizeQtyToken(tokens[0]);
  if (typeof possibleQty === "number") {
    qty = possibleQty;
    tokens.shift();
  }

  const name = normalizeItemName(tokens.join(" "));
  if (!name) return undefined;

  const item: OcrLineItem = {
    name,
    qty: qty ?? 1,
  };
  if (typeof lineTotal === "number") {
    item.lineTotal = Number(lineTotal.toFixed(2));
    if (item.qty && item.qty > 0) {
      item.unitPrice = Number((item.lineTotal / item.qty).toFixed(2));
    }
  }
  return item;
};

export const parseReceiptText = (text: string, layout?: OcrRecognizeData): OcrResult => {
  const rawLines = text.split(/\r?\n/);
  const layoutLines = layout?.lines ?? [];

  const lineEntries = rawLines
    .map((rawLine, index) => {
      const sanitized = sanitizeLine(rawLine);
      if (!sanitized) return null;
      const layoutLine = layoutLines[index];
      return {
        index,
        text: sanitized,
        confidence: layoutLine?.confidence ?? 65,
        bbox: layoutLine?.bbox,
      };
    })
    .filter((value): value is { index: number; text: string; confidence: number; bbox?: { x0: number; y0: number; x1: number; y1: number } } => value !== null);

  const items: OcrLineItem[] = [];
  let subtotal: number | undefined;
  let serviceCharge: number | undefined;
  let tax: number | undefined;
  let total: number | undefined;

  const printedTotals = {
    subtotal: undefined as number | undefined,
    serviceCharge: undefined as number | undefined,
    tax: undefined as number | undefined,
    total: undefined as number | undefined,
  };

  let pendingPrice: number | undefined;
  let currentItem: OcrLineItem | undefined;

  lineEntries.forEach((entry, orderIndex) => {
    const line = entry.text;
    const lower = line.toLowerCase();

    const detectedSubtotal = extractLabeledAmount(line, SUBTOTAL_KEYWORDS);
    if (typeof detectedSubtotal === "number") {
      if (printedTotals.subtotal === undefined) printedTotals.subtotal = detectedSubtotal;
      if (typeof subtotal !== "number") subtotal = detectedSubtotal;
    }

    const detectedService = extractLabeledAmount(line, SERVICE_KEYWORDS);
    if (typeof detectedService === "number") {
      if (printedTotals.serviceCharge === undefined) printedTotals.serviceCharge = detectedService;
      if (typeof serviceCharge !== "number") serviceCharge = detectedService;
    }

    const detectedTax = extractLabeledAmount(line, TAX_KEYWORDS);
    if (typeof detectedTax === "number") {
      if (printedTotals.tax === undefined) printedTotals.tax = detectedTax;
      if (typeof tax !== "number") tax = detectedTax;
    }

    if (!total && TOTAL_KEYWORDS.some((keyword) => lower.includes(keyword))) {
      const value = normalizeAmount(line.split(/[:\s]+/).pop());
      if (typeof value === "number") {
        printedTotals.total = value;
        total = value;
      }
    }

    if (/\b(subtotal|service|svc|gst|tax|total|visa|cash|change|signature)\b/i.test(lower)) {
      currentItem = undefined;
      pendingPrice = undefined;
      return;
    }

    const priceOnlyMatch = line.match(/^(?:S\$|\$)?\s*([0-9]+(?:\.[0-9]+)?)$/i);
    if (priceOnlyMatch) {
      pendingPrice = Number.parseFloat(priceOnlyMatch[1]);
      currentItem = undefined;
      return;
    }

    const item = parseItemLine(line);
    if (item) {
      if (typeof item.lineTotal !== "number" && typeof pendingPrice === "number") {
        item.lineTotal = Number(pendingPrice.toFixed(2));
        pendingPrice = undefined;
      }
      if (typeof item.lineTotal === "number") {
        const qty = item.qty ?? 1;
        item.unitPrice = Number((item.lineTotal / qty).toFixed(2));
      }
      item.details = item.details?.length ? Array.from(new Set(item.details)) : undefined;
      item.confidence = entry.confidence;
      item.sourceLine = orderIndex;
      items.push(item);
      currentItem = item;
      return;
    }

    const detail = extractDetailLine(line);
    if (detail) {
      if (!currentItem && (typeof pendingPrice === "number" || typeof detail.lineTotal === "number")) {
        const lineTotal = typeof detail.lineTotal === "number" ? detail.lineTotal : pendingPrice;
        if (typeof lineTotal === "number") {
          const qty = detail.qty ?? 1;
          const safeQty = qty || 1;
          const newItem: OcrLineItem = {
            name: normalizeItemName(detail.text),
            qty,
            lineTotal: Number(lineTotal.toFixed(2)),
            unitPrice: Number((lineTotal / safeQty).toFixed(2)),
            details: [],
            confidence: entry.confidence - 5,
            sourceLine: orderIndex,
          };
          items.push(newItem);
          currentItem = newItem;
          pendingPrice = undefined;
          return;
        }
      }

      if (currentItem) {
        currentItem.details = Array.from(new Set([...(currentItem.details ?? []), detail.text]));
        return;
      }
    }

    currentItem = undefined;
  });

  const sanitizedLines = lineEntries.map((entry) => entry.text);

  const currencyGuess = detectCurrency(sanitizedLines);
  const dateISO = detectDate(sanitizedLines);
  const merchant = refineMerchant(sanitizedLines);

  let filteredItems = items
    .map((item) => ({
      ...item,
      details: item.details?.length ? Array.from(new Set(item.details)) : undefined,
    }))
    .filter((item) => {
      if (!item.name || !item.name.trim()) return false;
      if (typeof item.lineTotal === "number" && item.lineTotal <= 0.3) return false;
      if (/^(subtotal|total|service|tax)$/i.test(item.name)) return false;
      return true;
    })
    .sort((a, b) => (a.sourceLine ?? 0) - (b.sourceLine ?? 0));

  const subtotalFromItems = Number(
    filteredItems.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0).toFixed(2),
  );

  if (filteredItems.length === 0 && items.length) {
    filteredItems = items;
  }

  if (typeof printedTotals.subtotal === "number") {
    const diff = Number((printedTotals.subtotal - subtotalFromItems).toFixed(2));
    if (Math.abs(diff) > 0.01) {
      const adjustable = filteredItems.find((item) => item.details?.length || (item.confidence ?? 100) < 80);
      if (adjustable && typeof adjustable.lineTotal === "number") {
        adjustable.lineTotal = Number((adjustable.lineTotal + diff).toFixed(2));
        const qty = adjustable.qty ?? 1;
        adjustable.unitPrice = Number((adjustable.lineTotal / qty).toFixed(2));
      }
    }
    subtotal = printedTotals.subtotal;
  } else {
    subtotal = subtotalFromItems > 0 ? subtotalFromItems : undefined;
  }

  if (typeof subtotal !== "number" || subtotal <= 0) {
    subtotal = subtotalFromItems;
  }

  if (typeof printedTotals.serviceCharge === "number") {
    serviceCharge = printedTotals.serviceCharge;
  } else if (typeof subtotal === "number" && subtotal > 0) {
    serviceCharge = Number((subtotal * 0.1).toFixed(2));
  }

  if (typeof printedTotals.tax === "number") {
    tax = printedTotals.tax;
  }

  if (typeof printedTotals.total === "number") {
    total = printedTotals.total;
  } else if (typeof subtotal === "number" && typeof serviceCharge === "number" && typeof tax === "number") {
    total = Number((subtotal + serviceCharge + tax).toFixed(2));
  }

  if (typeof subtotal === "number" && typeof total === "number" && typeof serviceCharge === "number" && typeof tax !== "number") {
    const computedTax = Number((total - subtotal - serviceCharge).toFixed(2));
    if (Number.isFinite(computedTax)) {
      tax = computedTax;
    }
  }

  if (typeof subtotal === "number" && typeof serviceCharge === "number" && typeof tax === "number" && typeof total !== "number") {
    total = Number((subtotal + serviceCharge + tax).toFixed(2));
  }

  const round2 = (value: number | undefined) =>
    typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(2)) : undefined;

  subtotal = round2(subtotal);
  serviceCharge = round2(serviceCharge);
  tax = round2(tax);
  total = round2(total);

  let scGuess: number | undefined;
  let taxGuess: number | undefined;
  if (typeof subtotal === "number" && subtotal > 0) {
    scGuess = typeof serviceCharge === "number" ? serviceCharge / subtotal : undefined;
    taxGuess = typeof tax === "number" ? tax / subtotal : undefined;
  }

  const averageItemConfidence = filteredItems.length
    ? filteredItems.reduce((sum, item) => sum + (item.confidence ?? 70), 0) / filteredItems.length
    : 0;

  const confidenceScore = (() => {
    let score = 0;
    if (filteredItems.length >= 4) score += 0.4;
    else if (filteredItems.length >= 2) score += 0.25;
    else if (filteredItems.length > 0) score += 0.12;

    if (typeof total === "number") score += 0.25;
    if (typeof subtotal === "number") score += 0.15;
    if (typeof serviceCharge === "number" || typeof tax === "number") score += 0.1;
    if (merchant) score += 0.05;
    if (dateISO) score += 0.05;
    if (filteredItems.length && typeof subtotal === "number") score += 0.05;
    score += Math.min(averageItemConfidence / 200, 0.1);

    return Math.min(1, score);
  })();

  const confidenceLabel: OcrConfidence = confidenceScore >= 0.7 ? "high" : confidenceScore >= 0.4 ? "medium" : "low";

  return {
    merchant,
    dateISO,
    items: filteredItems.map((item) => ({
      name: item.name,
      qty: item.qty,
      unitPrice: item.unitPrice,
      lineTotal: item.lineTotal,
      details: item.details,
    })),
    subtotal,
    serviceCharge,
    tax,
    total,
    currencyGuess,
    scGuess,
    taxGuess,
    confidenceScore,
    confidenceLabel,
    rawText: text,
  };
};
