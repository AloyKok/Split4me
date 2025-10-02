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
}

export interface OcrResult {
  merchant?: string;
  dateISO?: string;
  items: OcrLineItem[];
  subtotal?: number;
  serviceCharge?: number;
  tax?: number;
  total?: number;
  currencyGuess?: Currency;
  scGuess?: number;
  taxGuess?: number;
}

export interface ReceiptMetaState {
  merchant?: string;
  dateISO?: string;
  detected?: {
    subtotal?: number;
    serviceCharge?: number;
    tax?: number;
    total?: number;
  };
  useReceiptCharges: boolean;
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
