# Split4me – Receipt-based Bill Splitting

## Summary
Split4me helps groups in Southeast Asia settle restaurant bills. Users add friends, capture a receipt photo, and the app auto-fills item rows, service charge, and tax based on the chosen country preset. The UI supports both per-item and total-only splits, with percentage weights for uneven splits.

## Key Capabilities
- **Receipt capture** – Client-side enhancement (resize, grayscale, threshold) plus GPT-4o vision to extract items, quantities, and totals. Camera capture works directly in the browser with fallback to file upload.
- **Country-aware presets** – Service charge and tax default to the selected country (Singapore, Malaysia, Indonesia, Thailand, Philippines, Vietnam). OCR no longer overrides these values, preventing unwanted 10%/GST guesses.
- **Flexible splitting** – Items assigned explicitly are billed to those people. Remaining unassigned items automatically split by percentage weights. Service charge and tax are applied after item allocation and distributed proportionally.
- **Live editing** – All extracted fields remain editable (item name, quantity, price). Percent weights can be toggled and always sum to 100%. Unit price inputs accept trailing zeroes (e.g. `41.03`).
- **Confidence feedback** – OCR panel shows High/Medium/Low badges; low confidence keeps blank rows for manual entry.

## Architecture Overview
- **UI (Next.js / React)**
  - `TabsReceiptTotal` – main workflow (country selection, receipt meta, people chips, tabs for items vs total).
  - `ReceiptOcrPanel` – camera/upload controls, progress feedback, confidence badge.
  - `PeopleAssign` – manage participants + percentage weights.
  - `ResultsBar` – summarizes per-person totals.
- **Libs**
  - `src/lib/image-processing.ts` – preprocesses images client-side for better OCR.
  - `src/lib/ai/extract-receipt.ts` – calls OpenAI `/responses` API, enforces JSON schema, and normalizes OCR payload.
  - `src/lib/split.ts` – item and total splitting, weight normalization, rounding reconciliation.
  - `src/lib/receipt-parser.ts` – now used only for fallback? (retained but GPT handles extraction).
- **API**
  - `POST /api/ocr` – Receives a base64 image, invokes GPT-4o, returns structured `OcrResult`.

## Environment & Config
- `.env.local`
  ```
  OPENAI_API_KEY=sk-...
  # Optional override
  # OPENAI_OCR_MODEL=gpt-4o
  ```
- Camera capture requires HTTPS in production (or localhost) and user permission.

## Testing
- Unit tests (`npm run test`) using Vitest cover `splitItems` behaviour:
  - Unassigned items split by weight.
  - Mixed assigned/unassigned items yield expected results.
  - Service charge/tax applied after allocation.

## Data Flow
1. User uploads/takes photo → client preprocesses → POST `/api/ocr`.
2. API returns `OcrResult` (merchant/date/items + confidence).
3. Items mapped to editable rows. Unassigned items share weights; assigned items lock shares.
4. Country preset service charge/tax applied. Totals calculated and displayed.

## Outstanding Considerations
- GPT cost/latency: consider caching within session.
- Error handling: currently surfaces generic messages; could add retry/backoff.
- Accessibility: ARIA labels on camera modal/support for keyboard navigation.
- Data persistence: right now no storage; consider localStorage for session recall.
