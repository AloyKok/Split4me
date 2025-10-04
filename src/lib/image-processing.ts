const MAX_DIMENSION = 1600;
const CONTRAST = 0.35; // tweakable contrast boost
const BRIGHTNESS = 12; // additive brightness bump
const THRESHOLD_BIAS = -15; // shift adaptive threshold slightly darker

const ensureNumber = (value: number) => (Number.isFinite(value) ? value : 0);

const clamp = (value: number) => Math.min(255, Math.max(0, value));

const toGray = (r: number, g: number, b: number) => 0.299 * r + 0.587 * g + 0.114 * b;

const applyGrayscale = (data: Uint8ClampedArray) => {
  for (let i = 0; i < data.length; i += 4) {
    const gray = toGray(data[i], data[i + 1], data[i + 2]);
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
};

const applyContrast = (data: Uint8ClampedArray, value: number) => {
  const contrast = Math.max(-1, Math.min(1, value));
  const factor = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
  for (let i = 0; i < data.length; i += 4) {
    const gray = data[i];
    const contrasted = factor * (gray - 128) + 128;
    const clamped = clamp(contrasted);
    data[i] = data[i + 1] = data[i + 2] = clamped;
  }
};

const applyBrightness = (data: Uint8ClampedArray, delta: number) => {
  if (!delta) return;
  for (let i = 0; i < data.length; i += 4) {
    const value = clamp(data[i] + delta);
    data[i] = data[i + 1] = data[i + 2] = value;
  }
};

const applyThreshold = (data: Uint8ClampedArray) => {
  let sum = 0;
  const len = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    sum += data[i];
  }
  const mean = sum / len + THRESHOLD_BIAS;
  for (let i = 0; i < data.length; i += 4) {
    const value = data[i] < mean ? 0 : 255;
    data[i] = data[i + 1] = data[i + 2] = value;
  }
};

export interface ProcessedImage {
  imageData: ImageData;
  previewUrl: string;
  originalWidth: number;
  originalHeight: number;
  scaledWidth: number;
  scaledHeight: number;
  fileName: string;
}

const createCanvas = (width: number, height: number) => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Unable to obtain 2D context for preprocessing");
  }
  return { canvas, ctx };
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });

export const preprocessImageFile = async (file: File): Promise<ProcessedImage> => {
  const dataUrl = await readFileAsDataUrl(file);
  const image = new Image();
  const cleanupImage = () => {
    image.onload = null;
    image.onerror = null;
  };

  const bitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load selected image"));
    image.src = dataUrl;
  });

  cleanupImage();

  const originalWidth = ensureNumber(bitmap.naturalWidth || bitmap.width);
  const originalHeight = ensureNumber(bitmap.naturalHeight || bitmap.height);
  const maxDimension = Math.max(originalWidth, originalHeight) || 1;
  const scale = maxDimension > MAX_DIMENSION ? MAX_DIMENSION / maxDimension : 1;
  const scaledWidth = Math.max(1, Math.round(originalWidth * scale));
  const scaledHeight = Math.max(1, Math.round(originalHeight * scale));

  const { canvas, ctx } = createCanvas(scaledWidth, scaledHeight);
  ctx.drawImage(bitmap, 0, 0, scaledWidth, scaledHeight);

  const imageData = ctx.getImageData(0, 0, scaledWidth, scaledHeight);
  const data = imageData.data;

  applyGrayscale(data);
  applyContrast(data, CONTRAST);
  applyBrightness(data, BRIGHTNESS);
  applyThreshold(data);

  ctx.putImageData(imageData, 0, 0);
  const previewUrl = canvas.toDataURL("image/png");

  return {
    imageData,
    previewUrl,
    originalWidth,
    originalHeight,
    scaledWidth,
    scaledHeight,
    fileName: file.name,
  };
};
