import { useCallback, useRef, useState } from "react";

import { preprocessImageFile, type ProcessedImage } from "@/lib/image-processing";
import type { OcrResult } from "@/types";

export type ReceiptOcrStatus = "idle" | "preprocessing" | "recognizing" | "parsing" | "done" | "error";

interface UseReceiptOcrOptions {
  onResult?: (result: OcrResult, processed: ProcessedImage) => void;
  onError?: (message: string) => void;
}

export interface ReceiptOcrState {
  status: ReceiptOcrStatus;
  progress: number;
  message?: string;
  error?: string | null;
  preview?: string;
  processed?: ProcessedImage;
  result?: OcrResult;
}

export const useReceiptOcr = ({ onResult, onError }: UseReceiptOcrOptions = {}) => {
  const [state, setState] = useState<ReceiptOcrState>({ status: "idle", progress: 0 });
  const activeJobRef = useRef<string | null>(null);

  const resetState = useCallback(() => {
    setState({ status: "idle", progress: 0 });
    activeJobRef.current = null;
  }, []);

  const run = useCallback(
    async (file: File) => {
      if (!file) return;
      if (activeJobRef.current) return;

      const jobId =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `job-${Math.random().toString(36).slice(2)}`;
      activeJobRef.current = jobId;

      try {
        setState({ status: "preprocessing", progress: 0.15, message: "Enhancing receipt", error: null });
        const processed = await preprocessImageFile(file);

        setState((previous) => ({
          ...previous,
          status: "recognizing",
          progress: 0.5,
          message: "Sending to OCR service",
          preview: processed.previewUrl,
          processed,
          error: null,
        }));

        const apiResponse = await fetch("/api/ocr", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ image: processed.previewUrl }),
        });

        if (!apiResponse.ok) {
          const payload = await apiResponse.json().catch(() => ({}));
          const message = typeof payload?.error === "string" ? payload.error : "OCR service failed";
          throw new Error(message);
        }

        const data = (await apiResponse.json()) as { result: OcrResult };
        const parsed = data.result;

        setState({
          status: "done",
          progress: 1,
          message: "Receipt ready",
          preview: processed.previewUrl,
          processed,
          result: parsed,
          error: null,
        });

        onResult?.(parsed, processed);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unable to read receipt";
        setState({
          status: "error",
          progress: 0,
          message: undefined,
          error: message,
        });
        onError?.(message);
      } finally {
        activeJobRef.current = null;
      }
    },
    [onError, onResult],
  );

  return {
    ...state,
    run,
    reset: resetState,
  };
};
