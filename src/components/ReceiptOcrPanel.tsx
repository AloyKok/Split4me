"use client";

import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";

import { useReceiptOcr } from "@/hooks/use-receipt-ocr";
import type { OcrConfidence, OcrResult } from "@/types";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const confidenceStyles: Record<OcrConfidence, { label: string; tone: string }> = {
  high: { label: "High confidence", tone: "bg-emerald-500/10 text-emerald-600" },
  medium: { label: "Medium confidence", tone: "bg-amber-500/10 text-amber-600" },
  low: { label: "Low confidence", tone: "bg-red-500/10 text-red-600" },
};

interface CameraCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCapture: (file: File) => void;
  disabled?: boolean;
}

const CameraCaptureDialog = ({ open, onOpenChange, onCapture, disabled }: CameraCaptureDialogProps) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setIsReady(false);
  }, []);

  const handleClose = useCallback(
    (next: boolean) => {
      if (!next) {
        stopStream();
      }
      onOpenChange(next);
    },
    [onOpenChange, stopStream],
  );

  const startStream = useCallback(async () => {
    if (disabled || typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setError("Camera access is not supported on this device. Please upload a photo instead.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsReady(true);
      }
    } catch (err) {
      console.error("camera error", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to access the camera. Please allow camera permissions and try again.",
      );
    }
  }, [disabled]);

  const handleCapture = useCallback(async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const context = canvas.getContext("2d");
    if (!context) {
      setError("Unable to capture photo. Try again.");
      return;
    }
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) {
        setError("Capture failed. Please try again.");
        return;
      }
      const file = new File([blob], `receipt-${Date.now()}.jpg`, { type: blob.type });
      stopStream();
      onCapture(file);
      onOpenChange(false);
    }, "image/jpeg", 0.92);
  }, [onCapture, onOpenChange, stopStream]);

  useEffect(() => {
    if (open) {
      setError(null);
      void startStream();
    } else {
      stopStream();
    }
    return () => stopStream();
  }, [open, startStream, stopStream]);

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Point your camera at the receipt</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="aspect-[3/4] w-full overflow-hidden rounded-lg bg-muted">
            <video ref={videoRef} className="h-full w-full object-contain" playsInline muted />
          </div>
          {error ? <p className="text-sm text-destructive">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => handleClose(false)}>
              Cancel
            </Button>
            <Button onClick={handleCapture} disabled={!isReady || Boolean(error)}>
              Take photo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

interface ReceiptOcrPanelProps {
  onReceiptParsed: (result: OcrResult) => void;
}

export const ReceiptOcrPanel = ({ onReceiptParsed }: ReceiptOcrPanelProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);

  const ocr = useReceiptOcr({
    onResult: (result) => {
      onReceiptParsed(result);
    },
  });

  const isBusy = ocr.status === "preprocessing" || ocr.status === "recognizing" || ocr.status === "parsing";

  const confidenceBadge = useMemo(() => {
    if (!ocr.result) return null;
    return confidenceStyles[ocr.result.confidenceLabel];
  }, [ocr.result]);

  const handleSelect = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      ocr.run(file);
      event.target.value = "";
    }
  };

  const handleCameraCapture = useCallback(
    (file: File) => {
      if (!file) return;
      ocr.run(file);
    },
    [ocr],
  );

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-4">
          <div>
            <CardTitle>Snap Your Receipt</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">
              Upload a photo of the bill or take one on the spot. We’ll do the typing for you so you can jump straight to splitting.
            </p>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
         <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleSelect} />
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleSelect}
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={isBusy}>
            Upload image
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              if (navigator.mediaDevices?.getUserMedia) {
                setCameraOpen(true);
              } else {
                cameraInputRef.current?.click();
              }
            }}
            disabled={isBusy}
          >
            Take photo
          </Button>
        </div>

        {ocr.status !== "idle" ? (
          <div className="space-y-2">
            {ocr.message ? <p className="text-xs text-muted-foreground">{ocr.message}</p> : null}
            <div className="h-2 w-full rounded-full bg-muted">
              <div
                className="h-2 rounded-full bg-primary transition-all"
                style={{ width: `${Math.min(100, Math.round(ocr.progress * 100))}%` }}
              />
            </div>
          </div>
        ) : null}

        {ocr.error ? <p className="text-sm text-destructive">{ocr.error}</p> : null}

        {ocr.preview ? (
          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">Enhanced preview</p>
            <div className="overflow-hidden rounded-lg border border-border bg-muted/30">
              <Image
                src={ocr.preview}
                alt="Receipt preview"
                width={ocr.processed?.scaledWidth ?? 400}
                height={ocr.processed?.scaledHeight ?? 600}
                sizes="(max-width: 768px) 100vw, 640px"
                unoptimized
                className="max-h-64 w-full object-contain"
              />
            </div>
          </div>
        ) : null}

        {ocr.result ? (
          <div className="space-y-2 rounded-lg border border-border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm font-medium">
                Detected {ocr.result.items.length} item{ocr.result.items.length === 1 ? "" : "s"}.
              </p>
              {confidenceBadge ? <Badge className={confidenceBadge.tone}>{confidenceBadge.label}</Badge> : null}
            </div>
            {ocr.result.confidenceLabel === "low" ? (
              <p className="text-xs text-amber-600">
                Detection looks uncertain. We&apos;ll prefill a few empty rows so you can type the receipt manually.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Review the items below and tweak anything the camera might have missed.
              </p>
            )}
          </div>
        ) : null}
      </CardContent>
      </Card>

      <CameraCaptureDialog
        open={cameraOpen}
        onOpenChange={setCameraOpen}
        onCapture={handleCameraCapture}
        disabled={isBusy}
      />
    </>
  );
};
