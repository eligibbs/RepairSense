"use client";

import { Camera, ScanLine, TextSearch, X, Zap } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

type ScannerControls = { stop: () => void };
type LocalOcrService = import("ppu-paddle-ocr/web").PaddleOcrService;
type ScanMode = "barcode" | "text";
type CameraCapabilities = MediaTrackCapabilities & {
  focusMode?: string[];
  torch?: boolean;
};
type CameraConstraint = MediaTrackConstraintSet & {
  focusMode?: string;
  torch?: boolean;
};
type BrowserImageCapture = { takePhoto: () => Promise<Blob> };
type DetectedBarcode = { rawValue?: string };
type NativeBarcodeDetector = { detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]> };
type NativeBarcodeDetectorConstructor = new (options?: { formats?: string[] }) => NativeBarcodeDetector;

const subscribeToBrowser = () => () => {};

function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return "Camera access was denied. Allow camera access in your browser settings and try again.";
    if (error.name === "NotFoundError") return "No camera was found on this device.";
    if (error.name === "NotReadableError") return "The camera is already in use by another application.";
  }
  return "The camera could not be started. Camera scanning requires HTTPS or localhost access.";
}

function preferredRearCamera(devices: MediaDeviceInfo[]): MediaDeviceInfo | null {
  const rearCameras = devices.filter((device) => /\b(?:back|rear|environment)\b/i.test(device.label));
  rearCameras.sort((left, right) => {
    const leftNumbers = left.label.match(/\d+/g);
    const rightNumbers = right.label.match(/\d+/g);
    const leftNumber = Number(leftNumbers?.at(-1) ?? Number.MAX_SAFE_INTEGER);
    const rightNumber = Number(rightNumbers?.at(-1) ?? Number.MAX_SAFE_INTEGER);
    return leftNumber - rightNumber || left.label.localeCompare(right.label);
  });
  return rearCameras[0] ?? null;
}

function serialCandidates(text: string): string[] {
  const appleContext = /\b(?:APPLE|MACBOOK|IMAC)\b|DESIGNED\s+BY\s+APP/i.test(text);
  const scored = new Map<string, number>();
  const observed = new Set<string>();
  const store = (value: string, score: number, directlyObserved: boolean) => {
    if (value.length < 5 || value.length > 30 || !/\d/.test(value)) return;
    const commonLengthBonus = [10, 11, 12].includes(value.length) ? 10 : 0;
    const mergedTextPenalty = value.length > 12 ? 20 : 0;
    scored.set(value, Math.max(scored.get(value) ?? 0, score + commonLengthBonus - mergedTextPenalty));
    if (directlyObserved) observed.add(value);
  };
  const add = (rawValue: string, score: number, directlyObserved = true) => {
    let value = rawValue.toUpperCase().replace(/[^A-Z0-9-]/g, "").replace(/^-+|-+$/g, "");
    if (appleContext) value = value.replace(/O/g, "0").replace(/I/g, "1");
    store(value, score, directlyObserved);

    if (value.length > 12 && value.length <= 20) {
      for (const serialLength of [12, 11, 10]) {
        const prefix = value.slice(0, serialLength);
        const suffix = value.slice(serialLength);
        if (!/[A-Z]/.test(prefix) || !/\d/.test(prefix)) continue;
        const regulatorySuffix = /^(?:CE|CEX|FCC|UKCA|ICES?|EAC|RCM)/.test(suffix);
        store(prefix, score + (regulatorySuffix ? 65 : 12), false);
      }
    }
  };

  for (const line of text.split(/\r?\n/)) {
    const label = line.match(/(?:SERIAL(?:\s*(?:NUMBER|NO\.?))?|S\s*[\\/]\s*N|\bSN)\s*[:#-]?\s*/i);
    if (label?.index !== undefined) {
      const tail = line.slice(label.index + label[0].length);
      add(tail, 120);
      for (const token of tail.match(/[A-Z0-9][A-Z0-9\s./-]{4,35}/gi) ?? []) add(token, 110);
    }

    for (const token of line.match(/[A-Z0-9][A-Z0-9-]{5,24}/gi) ?? []) {
      if (/^(?:MODEL|SERIAL|NUMBER|DEVICE|DESIGNED|ASSEMBLED|APPLE|SAMSUNG|LENOVO|MICROSOFT|MACBOOK|GALAXY)$/i.test(token)) continue;
      add(token, /^[A-Z0-9]{10,12}$/i.test(token) ? 80 : /[A-Z]/i.test(token) ? 50 : 20);
    }

    const compactLine = line.replace(/[^A-Z0-9-]/gi, "");
    if (compactLine.length >= 6 && compactLine.length <= 24) add(compactLine, /^[A-Z0-9]{10,12}$/i.test(compactLine) ? 75 : 35);
  }

  const confusableReplacements: Record<string, string> = { B: "8", E: "6", G: "6", I: "1", O: "0", S: "5", Z: "2" };
  const originalCandidates = [...scored.entries()];
  const addConfusableVariants = (value: string, score: number) => {
    const normalized = appleContext ? value.replace(/[IO]/g, (character) => confusableReplacements[character]) : value;
    add(normalized, score + 3, false);
    for (let index = 0; index < normalized.length; index += 1) {
      const replacement = confusableReplacements[normalized[index]];
      if (replacement) add(`${normalized.slice(0, index)}${replacement}${normalized.slice(index + 1)}`, score, false);
    }
  };

  for (const [value, score] of originalCandidates) {
    // A 13-character result is commonly a 12-character serial with one OCR
    // insertion. Offer ranked removals plus glyph corrections for confirmation.
    if (value.length === 13) {
      for (let index = 0; index < value.length; index += 1) {
        const likelyInsertionBonus = /[0IO]/.test(value[index]) ? 8 : 0;
        addConfusableVariants(`${value.slice(0, index)}${value.slice(index + 1)}`, score + 8 + likelyInsertionBonus);
      }
    } else if (!appleContext) {
      // For other manufacturers preserve the literal O/I reading and offer
      // only the two most common numeric alternatives without flooding results.
      for (let index = 0; index < value.length; index += 1) {
        if (value[index] === "O" || value[index] === "I") {
          add(`${value.slice(0, index)}${confusableReplacements[value[index]]}${value.slice(index + 1)}`, score - 2, false);
        }
      }
    }
  }

  const ranked = [...scored.entries()].sort((a, b) => b[1] - a[1] || b[0].length - a[0].length).map(([value]) => value);
  const literalCandidates = [...observed].filter((value) => value.length <= 12).sort((a, b) => (scored.get(b) ?? 0) - (scored.get(a) ?? 0));
  return [...new Set([...literalCandidates.slice(0, 4), ...ranked])].slice(0, 12);
}

function createAutoContrastCanvas(grayValues: Uint8ClampedArray, width: number, height: number): HTMLCanvasElement {
  const output = document.createElement("canvas");
  output.width = width;
  output.height = height;
  const context = output.getContext("2d");
  if (!context) return output;

  const histogram = new Uint32Array(256);
  for (const value of grayValues) histogram[value] += 1;
  const lowTarget = grayValues.length * 0.01;
  const highTarget = grayValues.length * 0.99;
  let cumulative = 0;
  let low = 0;
  let high = 255;
  for (let value = 0; value < histogram.length; value += 1) {
    cumulative += histogram[value];
    if (cumulative >= lowTarget) {
      low = value;
      break;
    }
  }
  cumulative = 0;
  for (let value = 0; value < histogram.length; value += 1) {
    cumulative += histogram[value];
    if (cumulative >= highTarget) {
      high = value;
      break;
    }
  }
  if (high - low < 20) {
    low = Math.max(0, low - 10);
    high = Math.min(255, high + 10);
  }

  const image = context.createImageData(width, height);
  const range = Math.max(1, high - low);
  for (let index = 0; index < grayValues.length; index += 1) {
    const value = Math.max(0, Math.min(255, ((grayValues[index] - low) * 255) / range));
    const pixel = index * 4;
    image.data[pixel] = value;
    image.data[pixel + 1] = value;
    image.data[pixel + 2] = value;
    image.data[pixel + 3] = 255;
  }
  context.putImageData(image, 0, 0);
  return output;
}

export function BarcodeScannerButton({ disabled = false, onDetected }: { disabled?: boolean; onDetected: (value: string) => void }) {
  const mounted = useSyncExternalStore(subscribeToBrowser, () => true, () => false);
  const overlayRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<ScannerControls | null>(null);
  const videoTrackRef = useRef<MediaStreamTrack | null>(null);
  const ocrServiceRef = useRef<LocalOcrService | null>(null);
  const sessionRef = useRef(0);
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ScanMode>("barcode");
  const [cameraActive, setCameraActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [processingLabel, setProcessingLabel] = useState("Reading printed text…");
  const [progress, setProgress] = useState(0);
  const [candidates, setCandidates] = useState<string[]>([]);
  const [selectedText, setSelectedText] = useState("");
  const [recognizedText, setRecognizedText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [selectedCameraId, setSelectedCameraId] = useState("");
  const [torchSupported, setTorchSupported] = useState(false);
  const [torchOn, setTorchOn] = useState(false);

  function stopCamera() {
    controlsRef.current?.stop();
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject;
    if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
    videoTrackRef.current = null;
    setTorchOn(false);
  }

  function cameraConstraints(deviceId?: string): MediaTrackConstraints {
    return {
      ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } }),
      width: { ideal: 2560 },
      height: { ideal: 1440 },
    };
  }

  async function applyCameraConstraint(track: MediaStreamTrack, constraint: CameraConstraint) {
    try {
      await track.applyConstraints({ advanced: [constraint] } as MediaTrackConstraints);
    } catch {
      // Camera controls differ by browser and lens; unsupported enhancements are optional.
    }
  }

  async function configureCamera(track: MediaStreamTrack): Promise<string | null> {
    videoTrackRef.current = track;
    track.contentHint = "detail";
    const capabilities = track.getCapabilities() as CameraCapabilities;
    const canContinuouslyFocus = capabilities.focusMode?.includes("continuous") ?? false;
    setTorchSupported(capabilities.torch === true);
    if (canContinuouslyFocus) await applyCameraConstraint(track, { focusMode: "continuous" });

    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((device) => device.kind === "videoinput");
    const currentDeviceId = track.getSettings().deviceId ?? "";
    const preferredDeviceId = preferredRearCamera(devices)?.deviceId ?? currentDeviceId;
    setSelectedCameraId(preferredDeviceId);
    return preferredDeviceId && preferredDeviceId !== currentDeviceId ? preferredDeviceId : null;
  }

  async function refocusCamera() {
    const track = videoTrackRef.current;
    if (!track) return;
    const capabilities = track.getCapabilities() as CameraCapabilities;
    if (capabilities.focusMode?.includes("single-shot")) {
      await applyCameraConstraint(track, { focusMode: "single-shot" });
      await new Promise((resolve) => setTimeout(resolve, 350));
    }
    if (capabilities.focusMode?.includes("continuous")) await applyCameraConstraint(track, { focusMode: "continuous" });
  }

  async function toggleTorch() {
    const track = videoTrackRef.current;
    if (!track) return;
    const nextValue = !torchOn;
    await applyCameraConstraint(track, { torch: nextValue });
    setTorchOn(track.getSettings().torch ?? nextValue);
  }

  function resetResults() {
    setError(null);
    setCandidates([]);
    setSelectedText("");
    setRecognizedText("");
    setProgress(0);
  }

  async function startBarcodeScanner(deviceId = selectedCameraId) {
    resetResults();
    setStarting(true);
    const session = sessionRef.current + 1;
    sessionRef.current = session;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !videoRef.current || !canvasRef.current) throw new Error("Camera unavailable");
      const [{ BrowserMultiFormatReader }, { BarcodeFormat, DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
      const hints = new Map();
      hints.set(DecodeHintType.POSSIBLE_FORMATS, [BarcodeFormat.CODE_128, BarcodeFormat.CODE_39, BarcodeFormat.CODE_93, BarcodeFormat.DATA_MATRIX, BarcodeFormat.QR_CODE, BarcodeFormat.ITF, BarcodeFormat.CODABAR, BarcodeFormat.PDF_417, BarcodeFormat.UPC_A, BarcodeFormat.UPC_E, BarcodeFormat.EAN_13, BarcodeFormat.EAN_8]);
      hints.set(DecodeHintType.TRY_HARDER, true);
      const reader = new BrowserMultiFormatReader(hints);
      const NativeDetector = (window as typeof window & { BarcodeDetector?: NativeBarcodeDetectorConstructor }).BarcodeDetector;
      let nativeDetector: NativeBarcodeDetector | null = null;
      if (NativeDetector) {
        try {
          nativeDetector = new NativeDetector({ formats: ["qr_code", "code_128", "code_39", "code_93", "data_matrix", "pdf417", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "codabar"] });
        } catch {
          // Some browsers expose BarcodeDetector but accept only a subset of formats.
        }
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: cameraConstraints(deviceId) });
      if (sessionRef.current !== session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      const video = videoRef.current;
      const canvas = canvasRef.current;
      video.srcObject = stream;
      await video.play();
      const preferredDeviceId = await configureCamera(stream.getVideoTracks()[0]);
      if (preferredDeviceId && !deviceId) {
        stream.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
        await startBarcodeScanner(preferredDeviceId);
        return;
      }
      setCameraActive(true);

      let stopped = false;
      let scanTimeout: ReturnType<typeof setTimeout> | undefined;
      const stop = () => {
        stopped = true;
        if (scanTimeout) clearTimeout(scanTimeout);
        stream.getTracks().forEach((track) => track.stop());
      };
      controlsRef.current = { stop };

      let frameNumber = 0;
      const scanFrame = async () => {
        if (stopped || sessionRef.current !== session) return;
        if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth && video.videoHeight) {
          const regions = [
            { x: 0.05, y: 0.25, width: 0.9, height: 0.5 },
            { x: 0.025, y: 0.1, width: 0.95, height: 0.8 },
            { x: 0, y: 0, width: 1, height: 1 },
          ];
          const region = regions[frameNumber % regions.length];
          frameNumber += 1;
          const sourceX = Math.round(video.videoWidth * region.x);
          const sourceY = Math.round(video.videoHeight * region.y);
          const sourceWidth = Math.round(video.videoWidth * region.width);
          const sourceHeight = Math.round(video.videoHeight * region.height);
          const scale = Math.min(1, 1920 / sourceWidth);
          canvas.width = Math.max(1, Math.round(sourceWidth * scale));
          canvas.height = Math.max(1, Math.round(sourceHeight * scale));
          const context = canvas.getContext("2d", { willReadFrequently: true });
          context?.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
          if (context) {
            let value = "";
            if (nativeDetector) {
              try {
                const detected = await nativeDetector.detect(canvas);
                value = detected.find((barcode) => barcode.rawValue?.trim())?.rawValue?.trim() ?? "";
              } catch {
                // Fall through to ZXing when the browser detector rejects a frame or format.
              }
            }
            const originalWarning = console.warn;
            try {
              console.warn = (...values: unknown[]) => {
                if (!String(values[0] ?? "").startsWith("MultiFormatReader: non-ReaderException")) originalWarning(...values);
              };
              if (!value) value = reader.decodeFromCanvas(canvas).getText().trim();
              if (value) {
                stop();
                onDetected(value);
                closeScanner();
                return;
              }
            } catch {
              // A frame without a readable barcode is expected; keep scanning.
            } finally {
              console.warn = originalWarning;
            }
          }
        }
        scanTimeout = setTimeout(scanFrame, 150);
      };
      scanFrame();
    } catch (scanError) {
      if (sessionRef.current === session) setError(cameraErrorMessage(scanError));
    } finally {
      if (sessionRef.current === session) setStarting(false);
    }
  }

  async function startTextCamera(deviceId = selectedCameraId) {
    resetResults();
    setStarting(true);
    const session = sessionRef.current + 1;
    sessionRef.current = session;
    try {
      if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) throw new Error("Camera unavailable");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: cameraConstraints(deviceId) });
      if (sessionRef.current !== session) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      const preferredDeviceId = await configureCamera(stream.getVideoTracks()[0]);
      if (preferredDeviceId && !deviceId) {
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
        await startTextCamera(preferredDeviceId);
        return;
      }
      setCameraActive(true);
    } catch (scanError) {
      if (sessionRef.current === session) setError(cameraErrorMessage(scanError));
    } finally {
      if (sessionRef.current === session) setStarting(false);
    }
  }

  async function switchMode(nextMode: ScanMode) {
    sessionRef.current += 1;
    stopCamera();
    setCameraActive(false);
    setMode(nextMode);
    if (nextMode === "barcode") await startBarcodeScanner();
    else await startTextCamera();
  }

  async function captureText() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || !video.videoWidth || !video.videoHeight) {
      setError("The camera image is not ready yet. Try again in a moment.");
      return;
    }

    await refocusCamera();
    let imageSource: CanvasImageSource = video;
    let imageWidth = video.videoWidth;
    let imageHeight = video.videoHeight;
    let photoBitmap: ImageBitmap | null = null;
    const ImageCaptureConstructor = (window as typeof window & { ImageCapture?: new (track: MediaStreamTrack) => BrowserImageCapture }).ImageCapture;
    const track = videoTrackRef.current;
    if (ImageCaptureConstructor && track) {
      try {
        const photo = await new ImageCaptureConstructor(track).takePhoto();
        photoBitmap = await createImageBitmap(photo);
        imageSource = photoBitmap;
        imageWidth = photoBitmap.width;
        imageHeight = photoBitmap.height;
      } catch {
        // Fall back to the current video frame when still capture is unavailable.
      }
    }
    // Capture slightly beyond the visible guide so characters placed on its
    // edge are not clipped before OCR segmentation.
    const sourceX = Math.round(imageWidth * 0.02);
    const sourceY = Math.round(imageHeight * 0.29);
    const sourceWidth = Math.round(imageWidth * 0.96);
    const sourceHeight = Math.round(imageHeight * 0.42);
    const scale = Math.min(2, 3200 / sourceWidth);
    canvas.width = Math.round(sourceWidth * scale);
    canvas.height = Math.round(sourceHeight * scale);
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(imageSource, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
    photoBitmap?.close();
    const colorCanvas = document.createElement("canvas");
    colorCanvas.width = canvas.width;
    colorCanvas.height = canvas.height;
    colorCanvas.getContext("2d")?.drawImage(canvas, 0, 0);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height);
    const grayValues = new Uint8ClampedArray(canvas.width * canvas.height);
    for (let index = 0; index < pixels.data.length; index += 4) {
      const gray = 0.299 * pixels.data[index] + 0.587 * pixels.data[index + 1] + 0.114 * pixels.data[index + 2];
      grayValues[index / 4] = gray;
      pixels.data[index] = gray;
      pixels.data[index + 1] = gray;
      pixels.data[index + 2] = gray;
    }
    context.putImageData(pixels, 0, 0);
    const enhancedCanvas = createAutoContrastCanvas(grayValues, canvas.width, canvas.height);
    stopCamera();
    setCameraActive(false);
    setProcessing(true);
    setProcessingLabel("Loading local OCR model…");
    setProgress(0.05);
    setError(null);
    const session = sessionRef.current;

    try {
      let service = ocrServiceRef.current;
      if (!service) {
        const { PaddleOcrService, V5_EN_MOBILE_MODEL } = await import("ppu-paddle-ocr/web");
        const nextService = new PaddleOcrService({
          model: V5_EN_MOBILE_MODEL,
          detection: {
            maxSideLength: 1920,
            minimumAreaThreshold: 4,
            paddingHorizontal: 0.8,
            paddingVertical: 0.6,
          },
          recognition: {
            charactersDictionary: [],
            mainThreadYieldMs: 16,
            maxCropSourceSideLength: 3200,
            minimumConfidence: 0.08,
            spaceRecovery: false,
            strategy: "per-box",
          },
          processing: { engine: "canvas-native" },
        });
        await nextService.initialize();
        service = nextService;
        ocrServiceRef.current = nextService;
      }
      if (!service) throw new Error("OCR service did not initialize.");
      if (sessionRef.current !== session) return;
      setProcessingLabel("Detecting serial text…");
      setProgress(0.3);
      const colorResult = await service.recognize(colorCanvas, { flatten: true, minimumConfidence: 0.08, noCache: true, recBatchSize: 1, rotateVerticalCrops: false, spaceRecovery: false, strategy: "per-box" });
      if (sessionRef.current !== session) return;
      setProcessingLabel("Checking low-contrast characters…");
      setProgress(0.65);
      const enhancedResult = await service.recognize(enhancedCanvas, { flatten: true, minimumConfidence: 0.05, noCache: true, recBatchSize: 1, rotateVerticalCrops: false, spaceRecovery: false, strategy: "per-box" });
      if (sessionRef.current !== session) return;
      setProgress(1);
      const text = [colorResult.text.trim(), enhancedResult.text.trim()].filter(Boolean).join("\n");
      const detected = serialCandidates(text);
      setRecognizedText(text);
      setCandidates(detected);
      setSelectedText(detected[0] ?? text.split(/\s+/).find((value) => value.length >= 5) ?? "");
      if (!text) setError("No readable text was found. Improve the lighting, move closer, and scan again.");
    } catch (ocrError) {
      console.error("Local OCR failed", ocrError);
      if (sessionRef.current === session) setError("Text recognition failed. Try again with steadier framing and brighter, even lighting.");
    } finally {
      if (sessionRef.current === session) setProcessing(false);
    }
  }

  function applyValue(value: string) {
    const cleaned = value.trim();
    if (!cleaned) return;
    onDetected(cleaned);
    closeScanner();
  }

  async function openScanner() {
    setMode("barcode");
    setCameraActive(false);
    resetResults();
    setOpen(true);
    requestAnimationFrame(() => overlayRef.current?.focus());
    await startBarcodeScanner();
  }

  function closeScanner() {
    sessionRef.current += 1;
    stopCamera();
    setCameraActive(false);
    setStarting(false);
    setProcessing(false);
    setTorchSupported(false);
    setOpen(false);
  }

  useEffect(() => () => {
    controlsRef.current?.stop();
    const stream = videoRef.current?.srcObject;
    if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    void ocrServiceRef.current?.destroy();
  }, []);

  const showCapturedImage = mode === "text" && !cameraActive && (processing || Boolean(recognizedText));

  return <>
    <button aria-label="Scan serial number with camera" className="grid h-control w-10 shrink-0 place-items-center rounded-r-md border border-l-0 border-border bg-zinc-50 text-muted hover:bg-zinc-100 hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50" disabled={disabled} onClick={openScanner} title="Scan serial number with camera" type="button"><ScanLine className="size-4" /></button>
    {mounted && createPortal(
      <div aria-label="Serial number scanner" aria-modal="true" className={open ? "fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4" : "hidden"} onKeyDown={(event) => { if (event.key === "Escape") closeScanner(); }} onMouseDown={(event) => { if (event.target === event.currentTarget) closeScanner(); }} ref={overlayRef} role="dialog" tabIndex={-1}>
      <section className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-border bg-white text-foreground shadow-xl" onMouseDown={(event) => event.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-border bg-zinc-50 px-panel py-2.5"><div><h2 className="text-sm font-semibold">Scan serial number</h2><p className="text-2xs text-muted">Read a barcode or printed text using this device.</p></div><button aria-label="Close serial scanner" className="grid size-7 place-items-center rounded-md text-muted hover:bg-zinc-100" onClick={closeScanner} type="button"><X className="size-4" /></button></header>
        <div className="grid grid-cols-2 border-b border-border p-1">
          <button className={`button-ghost ${mode === "barcode" ? "bg-primary-soft text-primary" : ""}`} onClick={() => void switchMode("barcode")} type="button"><ScanLine className="size-3.5" />Barcode</button>
          <button className={`button-ghost ${mode === "text" ? "bg-primary-soft text-primary" : ""}`} onClick={() => void switchMode("text")} type="button"><TextSearch className="size-3.5" />Printed text</button>
        </div>
        <div className="p-3">
          <div className="relative overflow-hidden rounded-md border border-border bg-black">
            <video aria-label="Camera preview" autoPlay className={`${showCapturedImage ? "hidden" : "block"} aspect-[4/3] w-full object-cover`} muted onClick={() => void refocusCamera()} playsInline ref={videoRef} />
            <canvas aria-label="Captured device label" className={`${showCapturedImage ? "block" : "hidden"} aspect-[4/3] w-full object-contain`} ref={canvasRef} />
            {!showCapturedImage && <div aria-hidden="true" className={`pointer-events-none absolute border-2 border-amber-400 shadow-[0_0_0_999px_rgb(0_0_0/0.28)] ${mode === "barcode" ? "inset-x-[5%] inset-y-[25%] rounded-md" : "inset-x-[5%] inset-y-[32%] rounded-md"}`} />}
            {cameraActive && torchSupported && <button aria-label={torchOn ? "Turn camera light off" : "Turn camera light on"} className={`absolute right-2 top-2 z-10 grid size-9 place-items-center rounded-full border text-white shadow-md ${torchOn ? "border-amber-300 bg-amber-500" : "border-white/40 bg-black/55"}`} onClick={(event) => { event.stopPropagation(); void toggleTorch(); }} title={torchOn ? "Turn light off" : "Turn light on"} type="button"><Zap className="size-4" fill={torchOn ? "currentColor" : "none"} /></button>}
            {starting && <div className="absolute inset-0 grid place-items-center bg-black/55 text-center text-white"><div><Camera className="mx-auto mb-2 size-6 animate-pulse" /><p className="text-xs font-semibold">Starting camera…</p><p className="mt-1 text-2xs">Approve camera access if prompted.</p></div></div>}
            {processing && <div className="absolute inset-0 grid place-items-center bg-black/55 text-center text-white"><div><TextSearch className="mx-auto mb-2 size-6 animate-pulse" /><p className="text-xs font-semibold">{processingLabel}</p><p className="mt-1 text-2xs">{Math.round(progress * 100)}%</p></div></div>}
          </div>

          {mode === "barcode" && !error && <p className="mt-2 text-center text-2xs text-muted">Hold the barcode horizontally inside the box. Tap the preview to refocus; the scanner closes automatically when read.</p>}
          {mode === "text" && cameraActive && !error && <p className="mt-2 text-center text-2xs text-muted">Fill the box with the serial line itself—not the whole device label. A printed SN, S/N, or Serial prefix is optional.</p>}
          {error && <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700" role="alert">{error}</p>}

          {mode === "text" && !processing && recognizedText && <div className="mt-3 border-t border-border pt-3">
            <p className="text-xs font-semibold">Detected serial candidates</p>
            <p className="mt-0.5 text-2xs text-muted">Confirm the characters before selecting; likely OCR corrections are included.</p>
            {candidates.length ? <div className="mt-2 flex flex-wrap gap-1.5">{candidates.map((candidate) => <button className="rounded-md border border-border bg-zinc-50 px-2 py-1 font-mono text-xs font-semibold hover:border-primary hover:text-primary" key={candidate} onClick={() => applyValue(candidate)} type="button">{candidate}</button>)}</div> : <p className="mt-1 text-2xs text-muted">No likely serial was isolated. Edit the recognized value below.</p>}
            <label className="mt-3 grid gap-1 text-xs font-medium">Serial value<span className="flex gap-2"><input className="control min-w-0 flex-1 font-mono" onChange={(event) => setSelectedText(event.target.value)} value={selectedText} /><button className="button-primary" disabled={!selectedText.trim()} onClick={() => applyValue(selectedText)} type="button">Use value</button></span></label>
            <details className="mt-2 text-2xs text-muted"><summary className="cursor-pointer">View all recognized text</summary><pre className="mt-1 max-h-28 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-zinc-50 p-2 font-mono">{recognizedText}</pre></details>
          </div>}
        </div>
        <footer className="flex justify-between gap-2 border-t border-border px-4 py-3">
          <button className="button-ghost border-border" onClick={closeScanner} type="button">Cancel</button>
          {mode === "text" && (cameraActive ? <button className="button-primary" disabled={processing} onClick={() => void captureText()} type="button"><Camera className="size-3.5" />Capture text</button> : <button className="button-ghost border-border" disabled={processing} onClick={() => void startTextCamera()} type="button"><Camera className="size-3.5" />Scan again</button>)}
        </footer>
      </section>
      </div>,
      document.body,
    )}
  </>;
}
