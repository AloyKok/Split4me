import type { OcrLineItem, OcrResult } from "@/types";

const MODEL = process.env.OPENAI_OCR_MODEL ?? "gpt-4.1-mini";

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const jsonTryParse = (payload: string) => {
  const trimmed = payload.trim();
  try {
    return JSON.parse(trimmed) as unknown;
  } catch (error) {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1)) as unknown;
      } catch {
        throw error;
      }
    }
    throw error;
  }
};

const toNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value.replace(/[^0-9.\-]/g, ""));
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
};

const mapItems = (items: unknown[]): OcrLineItem[] => {
  if (!Array.isArray(items)) return [];
  return items
    .map((entry) => {
      if (typeof entry !== "object" || entry === null) return undefined;
      const record = entry as Record<string, unknown>;
      const nameRaw = typeof record.name === "string" ? record.name.trim() : "";
      if (!nameRaw) return undefined;
      const qty = toNumber(record.qty) ?? 1;
      const lineTotal = toNumber(record.lineTotal);
      const detailsArray = Array.isArray(record.details)
        ? record.details
            .map((detail) => (typeof detail === "string" ? detail.trim() : ""))
            .filter((detail) => detail.length > 0)
        : undefined;
      const confidence = toNumber(record.confidence);
      return {
        name: nameRaw,
        qty,
        lineTotal: lineTotal !== undefined ? Number(lineTotal.toFixed(2)) : undefined,
        unitPrice: lineTotal !== undefined ? Number((lineTotal / (qty || 1)).toFixed(2)) : undefined,
        details: detailsArray && detailsArray.length ? Array.from(new Set(detailsArray)) : undefined,
        confidence,
      } satisfies OcrLineItem;
    })
    .filter((item): item is OcrLineItem => Boolean(item));
};

const buildOcrResult = (
  payload: Record<string, unknown>,
  rawJson: string,
): OcrResult => {
  const merchant = typeof payload.merchant === "string" ? payload.merchant.trim() : undefined;
  const dateISO = typeof payload.dateISO === "string" ? payload.dateISO.trim() : undefined;
  const items = mapItems((payload.items as unknown[]) ?? []);

  const confidenceObj = (payload.confidence as Record<string, unknown>) ?? {};
  const scoreRaw = toNumber(confidenceObj.score);
  const confidenceScore = scoreRaw !== undefined ? clamp(scoreRaw, 0, 1) : 0.75;
  const labelRaw = typeof confidenceObj.label === "string" ? confidenceObj.label.toLowerCase() : undefined;
  const confidenceLabel = labelRaw === "high" || labelRaw === "medium" || labelRaw === "low"
    ? labelRaw
    : confidenceScore >= 0.75
      ? "high"
      : confidenceScore >= 0.5
        ? "medium"
        : "low";

  return {
    merchant,
    dateISO,
    items,
    confidenceScore,
    confidenceLabel,
    rawText: rawJson,
  };
};

export class OpenAiOcrError extends Error {
  constructor(message: string, public status?: number, public cause?: unknown) {
    super(message);
    this.name = "OpenAiOcrError";
  }
}

export const extractReceiptViaOpenAI = async (imageDataUrl: string): Promise<OcrResult> => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new OpenAiOcrError("OPENAI_API_KEY is not set");
  }

  if (!imageDataUrl.startsWith("data:")) {
    throw new OpenAiOcrError("Image must be provided as a data URL");
  }

  const instruction = `Extract structured data from the receipt image.
Provide JSON only, matching this schema:
{
  "merchant": string | null,
  "dateISO": string | null,
  "items": Array<{ "name": string, "qty": number, "lineTotal": number, "details"?: string[] }>,
  "confidence": { "score": number (0-1), "label": "high" | "medium" | "low" }
}
Guidelines:
- Normalise item names (e.g. "Dr Loin Katsu") and include option sub-items as details.
- Convert all currency values to numeric types (no strings).
- If the receipt omits a value, use null.
- Focus on item rows; ignore overall subtotal/service charge/tax/total lines in the output.
- For time-only values, assume Asia/Singapore and output ISO-8601 with "+08:00" offset.
- Include exactly the keys above and nothing else.`;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_output_tokens: 1200,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: instruction },
            { type: "input_image", image_url: imageDataUrl },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new OpenAiOcrError("Failed to extract receipt", response.status, errorText);
  }

  type OpenAIContent = { type: string; text?: string };
  type OpenAIOutput = { content?: OpenAIContent[] };
  type OpenAIResponse = { output?: OpenAIOutput[] };

  const payload = (await response.json()) as OpenAIResponse;
  const output = payload?.output;
  if (!Array.isArray(output) || !output.length) {
    throw new OpenAiOcrError("Unexpected response from OpenAI", response.status, payload);
  }

  const content = output[0]?.content;
  if (!Array.isArray(content)) {
    throw new OpenAiOcrError("Missing content in OpenAI response", response.status, payload);
  }

  const textChunk = content.find((entry) => entry?.type === "output_text")?.text;
  if (typeof textChunk !== "string") {
    throw new OpenAiOcrError("OpenAI response did not contain text output", response.status, payload);
  }

  const parsed = jsonTryParse(textChunk);
  if (typeof parsed !== "object" || parsed === null) {
    throw new OpenAiOcrError("OpenAI response was not valid JSON", response.status, parsed);
  }

  return buildOcrResult(parsed as Record<string, unknown>, textChunk);
};
