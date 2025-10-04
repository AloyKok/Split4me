import { extractReceiptViaOpenAI, OpenAiOcrError } from "@/lib/ai/extract-receipt";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const image = typeof body?.image === "string" ? body.image : undefined;
    if (!image) {
      return NextResponse.json({ error: "Missing image data" }, { status: 400 });
    }

    const result = await extractReceiptViaOpenAI(image);
    return NextResponse.json({ result });
  } catch (error) {
    if (error instanceof OpenAiOcrError) {
      console.error("OpenAI OCR error", error.cause ?? error.message);
      return NextResponse.json({ error: error.message }, { status: error.status ?? 500 });
    }
    console.error("OCR route error", error);
    return NextResponse.json({ error: "Failed to process receipt" }, { status: 500 });
  }
}
