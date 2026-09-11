// packages/mfe-id-ocr/src/camera/capturePhoto.ts
//
// Takes a still from a live camera preview and returns a JPEG under the upload size limit.
// Chromium: ImageCapture.takePhoto() at sensor resolution. Elsewhere: the sharpest of a few preview
// frames at full stream resolution. Optionally crops to an on-screen guide box, mapped through the
// element's object-fit onto the source pixels — never through a display-sized canvas.

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Size = { width: number; height: number };
export type Rect = Size & { x: number; y: number };

export type CropSpec = {
  overlay: Rect; // guide box in CSS px, relative to the <video> element's box
  container: Size; // the <video> element's CSS size
  fit?: "cover" | "contain"; // the element's object-fit (default cover)
  margin?: number; // fraction of the box added on each side for context (default 0.08)
  mirrored?: boolean; // true if the preview is flipped with transform: scaleX(-1)
};

export type CaptureOptions = {
  maxBytes?: number; // hard upload limit
  maxLongEdge?: number; // cap resolution first — nobody needs a 50 MP selfie
  minQuality?: number; // never encode below this; downscale instead
  frames?: number; // canvas path: frames sampled for sharpness
  crop?: CropSpec; // crop to a guide box, computed in source pixels
};

export type CaptureResult = {
  blob: Blob;
  width: number;
  height: number;
  quality: number;
  source: "takePhoto" | "canvas";
  cropped: boolean;
};

const MB = 1024 * 1024;
const QUALITY_STEPS = [0.95, 0.92, 0.9, 0.88, 0.85, 0.82, 0.8];

// ImageCapture is Chromium-only and absent from lib.dom; type only what we use.
type PhotoRange = { min: number; max: number; step: number };
type ImageCaptureLike = {
  getPhotoCapabilities(): Promise<{ imageWidth?: PhotoRange; imageHeight?: PhotoRange }>;
  takePhoto(settings?: { imageWidth?: number; imageHeight?: number }): Promise<Blob>;
};
type ImageCaptureWindow = Window & {
  ImageCapture?: new (track: MediaStreamTrack) => ImageCaptureLike;
};

// ---------------------------------------------------------------------------
// Canvas helpers
// ---------------------------------------------------------------------------

const fitLongEdge = (width: number, height: number, maxLongEdge: number): Size => {
  const scale = Math.min(1, maxLongEdge / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
};

const drawToCanvas = (source: CanvasImageSource, width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, width, height);
  return canvas;
};

const canvasToBlob = (canvas: HTMLCanvasElement, quality: number): Promise<Blob> =>
  new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas.toBlob returned null"))),
      "image/jpeg",
      quality,
    );
  });

// ---------------------------------------------------------------------------
// Fitting under the budget without wrecking quality
// ---------------------------------------------------------------------------

// Keep quality high and shed pixels first: JPEG blocking artifacts hurt face and document checks
// far more than a modest downscale does.
export const encodeUnderBudget = async (
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  limits: { maxBytes: number; maxLongEdge: number; minQuality: number },
): Promise<Omit<CaptureResult, "source" | "cropped">> => {
  let { width, height } = fitLongEdge(sourceWidth, sourceHeight, limits.maxLongEdge);

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const canvas = drawToCanvas(source, width, height);
    for (const quality of QUALITY_STEPS) {
      if (quality < limits.minQuality) break;
      const blob = await canvasToBlob(canvas, quality);
      if (blob.size <= limits.maxBytes) return { blob, width, height, quality };
    }
    // Still too big at minQuality: drop ~28% of the pixels and try again.
    width = Math.round(width * 0.85);
    height = Math.round(height * 0.85);
  }
  throw new Error(`Could not encode image under ${limits.maxBytes} bytes`);
};

// ---------------------------------------------------------------------------
// Native still (Chromium)
// ---------------------------------------------------------------------------

const takeNativePhoto = async (track: MediaStreamTrack, maxLongEdge: number): Promise<Blob | null> => {
  const Ctor = (window as ImageCaptureWindow).ImageCapture;
  if (!Ctor) return null;
  try {
    const capture = new Ctor(track);
    const caps = await capture.getPhotoCapabilities();
    const settings: { imageWidth?: number; imageHeight?: number } = {};
    if (caps.imageWidth && caps.imageHeight) {
      // Sensor's native aspect, capped to what we need — no point decoding 50 MP to throw it away.
      const fit = fitLongEdge(caps.imageWidth.max, caps.imageHeight.max, maxLongEdge);
      settings.imageWidth = fit.width;
      settings.imageHeight = fit.height;
    }
    return await capture.takePhoto(settings);
  } catch (error) {
    console.warn("[camera] takePhoto failed, falling back to canvas", error);
    return null;
  }
};

// ---------------------------------------------------------------------------
// Sharpest-of-N preview frames (Safari fallback)
// ---------------------------------------------------------------------------

// Relative sharpness (variance of a Laplacian) on a small grayscale copy. Only meaningful for
// comparing frames from the same camera moments apart — not as an absolute threshold.
const sharpness = (source: CanvasImageSource, width: number, height: number): number => {
  const w = 320;
  const h = Math.max(3, Math.round((height / width) * w));
  const ctx = drawToCanvas(source, w, h).getContext("2d");
  if (!ctx) return 0;
  const { data } = ctx.getImageData(0, 0, w, h);

  const gray = new Float32Array(w * h);
  for (let i = 0; i < gray.length; i += 1) {
    const r = data[i * 4] ?? 0;
    const g = data[i * 4 + 1] ?? 0;
    const b = data[i * 4 + 2] ?? 0;
    gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  const at = (i: number): number => gray[i] ?? 0;
  let sum = 0;
  let sumSq = 0;
  let n = 0;
  for (let y = 1; y < h - 1; y += 1) {
    for (let x = 1; x < w - 1; x += 1) {
      const i = y * w + x;
      const lap = 4 * at(i) - at(i - 1) - at(i + 1) - at(i - w) - at(i + w);
      sum += lap;
      sumSq += lap * lap;
      n += 1;
    }
  }
  const mean = sum / n;
  return sumSq / n - mean * mean;
};

const grabSharpestFrame = async (
  video: HTMLVideoElement,
  frames: number,
  intervalMs = 120,
): Promise<HTMLCanvasElement> => {
  // The stream's real size — never the element's CSS size.
  const width = video.videoWidth;
  const height = video.videoHeight;

  let best: { canvas: HTMLCanvasElement; score: number } | null = null;
  for (let i = 0; i < frames; i += 1) {
    const canvas = drawToCanvas(video, width, height);
    const score = sharpness(canvas, width, height);
    if (!best || score > best.score) best = { canvas, score };
    if (i < frames - 1) await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  if (!best) throw new Error("No frames captured");
  return best.canvas;
};

// ---------------------------------------------------------------------------
// Cropping to the guide box in source pixels
// ---------------------------------------------------------------------------

// Maps the guide box from the element's CSS pixels onto the source's pixels.
// Works for both object-fit values: with `contain` the overflow is negative (letterboxing).
export const mapOverlayToSource = (spec: CropSpec, source: Size): Rect => {
  const { overlay, container, fit = "cover", margin = 0.08, mirrored = false } = spec;
  const pick = fit === "cover" ? Math.max : Math.min;
  const scale = pick(container.width / source.width, container.height / source.height);
  const overflowX = (source.width * scale - container.width) / 2;
  const overflowY = (source.height * scale - container.height) / 2;

  let x = (overlay.x + overflowX) / scale;
  let y = (overlay.y + overflowY) / scale;
  let width = overlay.width / scale;
  let height = overlay.height / scale;

  // Context around the card lets the backend's own detection and perspective correction work.
  const padX = width * margin;
  const padY = height * margin;
  x -= padX;
  y -= padY;
  width += 2 * padX;
  height += 2 * padY;

  if (mirrored) x = source.width - x - width;

  const x0 = Math.max(0, Math.round(x));
  const y0 = Math.max(0, Math.round(y));
  const x1 = Math.min(source.width, Math.round(x + width));
  const y1 = Math.min(source.height, Math.round(y + height));
  return { x: x0, y: y0, width: x1 - x0, height: y1 - y0 };
};

// 1:1 copy of the source pixels inside `rect` — no resampling, nothing lost.
export const cropSource = (source: CanvasImageSource, rect: Rect): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  canvas.width = rect.width;
  canvas.height = rect.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.drawImage(source, rect.x, rect.y, rect.width, rect.height, 0, 0, rect.width, rect.height);
  return canvas;
};

// Builds the CropSpec from the live DOM, so the guide box can be styled freely in CSS and the crop
// always matches exactly what is on screen — including after viewport or URL-bar resizes.
export const cropSpecFromElements = (
  box: HTMLElement,
  video: HTMLVideoElement,
  extra: Omit<CropSpec, "overlay" | "container"> = {},
): CropSpec => {
  const b = box.getBoundingClientRect();
  const v = video.getBoundingClientRect();
  return {
    overlay: { x: b.left - v.left, y: b.top - v.top, width: b.width, height: b.height },
    container: { width: v.width, height: v.height },
    ...extra,
  };
};

// ---------------------------------------------------------------------------
// The capture entry point
// ---------------------------------------------------------------------------

const sameAspect = (a: Size, b: Size, tolerance = 0.02): boolean =>
  Math.abs(a.width / a.height - b.width / b.height) < tolerance;

export const capturePhoto = async (
  video: HTMLVideoElement,
  stream: MediaStream,
  options: CaptureOptions = {},
): Promise<CaptureResult> => {
  const { maxBytes = 5 * MB, maxLongEdge = 3200, minQuality = 0.85, frames = 4, crop } = options;
  if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
    throw new Error("Video has no frame to capture yet");
  }
  const limits = { maxBytes, maxLongEdge, minQuality };
  const preview: Size = { width: video.videoWidth, height: video.videoHeight };

  // When cropping, ask for a bigger still: the crop is what gets encoded, so the size cap should
  // apply to the card, not to the whole frame it is cut from.
  const stillLongEdge = crop ? Math.max(maxLongEdge, 4000) : maxLongEdge;
  const track = stream.getVideoTracks()[0];
  const native = track ? await takeNativePhoto(track, stillLongEdge) : null;

  if (native) {
    // Decode once, honouring EXIF orientation so the backend never receives a rotated image.
    const bitmap = await createImageBitmap(native, { imageOrientation: "from-image" });
    try {
      // The still must frame the same scene as the preview for the overlay to map onto it.
      // A 4:3 still behind a 16:9 preview does not, so in that case crop the preview instead.
      if (!crop || sameAspect(bitmap, preview)) {
        const source = crop ? cropSource(bitmap, mapOverlayToSource(crop, bitmap)) : bitmap;
        const encoded = await encodeUnderBudget(source, source.width, source.height, limits);
        return { ...encoded, source: "takePhoto", cropped: Boolean(crop) };
      }
      console.warn("[camera] still aspect differs from preview; cropping the preview frame instead");
    } finally {
      bitmap.close();
    }
  }

  const frame = await grabSharpestFrame(video, frames);
  const source = crop ? cropSource(frame, mapOverlayToSource(crop, frame)) : frame;
  const encoded = await encodeUnderBudget(source, source.width, source.height, limits);
  return { ...encoded, source: "canvas", cropped: Boolean(crop) };
};

// ---------------------------------------------------------------------------
// Interop
// ---------------------------------------------------------------------------

// For callers that still take a data URL. The string is ~4/3 the size of the blob; if a limit is
// enforced on the base64 form, pass `maxBytes: limit * 3 / 4` to capturePhoto.
export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Could not read blob"));
    reader.readAsDataURL(blob);
  });
