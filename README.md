# Split4me

Split4me is a browser-first bill splitting assistant for Southeast Asia. Add friends, record items or totals, and see who owes what in real time. Receipts can be auto-digitised with OpenAI’s GPT-4o vision API for higher accuracy extraction.

## Features

- 🇸🇬🇲🇾🇮🇩 Region-aware defaults for service charge, GST/SST, and currencies
- Two ways to split: per-item or by grand total with custom weightings
- Receipt digitisation powered by OpenAI GPT-4o (configurable via `OPENAI_API_KEY`)
- Smart parsing for line items with confidence scoring
- Service charge and tax presets auto-fill from the selected country (no OCR guesswork)
- No accounts required – data is kept client-side apart from the OCR API call
- Quick fallback options: blank item rows for manual entry when OCR is unsure

## Getting Started

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

Open http://localhost:3000 to view the app. Edits under `src` hot reload automatically.

### Linting

Run the project lint checks with:

```bash
npm run lint
```

## Using Receipt OCR (GPT-4o)

1. Open the app and switch to the **Items** tab if you want to review the generated rows.
2. In the **Snap Your Receipt** card:
   - Choose **Upload image** to pick an existing photo, or
   - Use **Take photo** to capture a receipt with the device camera.
3. The image is auto-enhanced (resize, grayscale, brightness and contrast) before being sent to GPT-4o for structured extraction.
4. Parsed line items auto-fill the Items table together with a High/Medium/Low confidence badge.
5. Service charge and tax follow the selected country preset—tweak them manually if your bill is different.
6. If detection looks weak, Split4me falls back to blank rows so you can type the receipt manually.
7. Adjust anything that needs fine-tuning – all fields remain editable after OCR.

### Environment

Create `.env.local` with your OpenAI key and (optionally) override the model:

```
OPENAI_API_KEY=sk-...
# OPENAI_OCR_MODEL=gpt-4o
```

## Project Structure

- `src/app/` – Next.js app router entry points
- `src/components/` – UI components (TabsReceiptTotal includes OCR UI)
- `src/lib/` – Calculation utilities plus OCR preprocessing and OpenAI integration helpers
- `src/hooks/` – Client hooks such as the OCR controller

## License

This project uses open-source dependencies including Tesseract.js. Review individual packages for license specifics.
