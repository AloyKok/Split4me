export type Country =
  | "Singapore"
  | "Malaysia"
  | "Indonesia"
  | "Thailand"
  | "Philippines"
  | "Vietnam";

export type Currency = "SGD" | "MYR" | "IDR" | "THB" | "PHP" | "VND";

export interface RatesState {
  serviceChargeEnabled: boolean;
  serviceChargeRate: number;
  taxRate: number;
  taxPreset: "gst9" | "sst6" | "sst8" | "custom";
}

export interface Person {
  id: string;
  name: string;
  weight: number;
  color: string;
}

export interface ItemAssignment {
  personId: string;
  sharePercent?: number;
}

export interface Item {
  id: string;
  name: string;
  qty: number;
  unitPrice: number;
  assignments: ItemAssignment[];
}

export interface OcrLineItem {
  name?: string;
  qty?: number;
  unitPrice?: number;
  lineTotal?: number;
  details?: string[];
  confidence?: number;
  sourceLine?: number;
}

export interface OcrResult {
  merchant?: string;
  dateISO?: string;
  items: OcrLineItem[];
  confidenceScore: number;
  confidenceLabel: OcrConfidence;
  rawText: string;
}

export type OcrConfidence = "high" | "medium" | "low";

export interface ReceiptMetaState {
  merchant?: string;
  dateISO?: string;
  confidence?: OcrConfidence;
  confidenceScore?: number;
}

export interface PersonShare {
  personId: string;
  items: number;
  serviceCharge: number;
  tax: number;
  total: number;
}

export interface SplitBreakdown {
  currency: Currency;
  beforeCharge: number;
  serviceChargeTotal: number;
  taxTotal: number;
  grandTotal: number;
  perPerson: PersonShare[];
}

export interface PreferencesState {
  country: Country;
  currency: Currency;
  rates: RatesState;
  roundingMode: "half-up" | "bankers";
}

export interface OcrLayoutBBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

export interface OcrLayoutWord {
  text: string;
  confidence: number;
}

export interface OcrLayoutLine {
  text: string;
  confidence: number;
  bbox: OcrLayoutBBox;
  words?: OcrLayoutWord[];
}

export interface OcrRecognizeData {
  text: string;
  lines?: OcrLayoutLine[];
  blocks?: Array<{
    bbox: OcrLayoutBBox;
  }>;
}
