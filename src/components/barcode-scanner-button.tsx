"use client";

import { ScanLine, X } from "lucide-react";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

type ScannerControls = { stop: () => void };

const subscribeToBrowser = () => () => {};

function cameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") return "Camera access was denied. Allow camera access in your browser settings and try again.";
    if (error.name === "NotFoundError") return "No camera was found on this device.";
    if (error.name === "NotReadableError") return "The camera is already in use by another application.";
  }
  return "The camera could not be started. Camera scanning requires HTTPS or localhost access.";
}

export function BarcodeScannerButton({ onDetected }: { onDetected: (value: string) => void }) {
  const mounted = useSyncExternalStore(subscribeToBrowser, () => true, () => false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<ScannerControls | null>(null);
  const sessionRef = useRef(0);
  const [error, setError] = useState<string | null>(null);

  function stopScanner() {
    sessionRef.current += 1;
    controlsRef.current?.stop();
    controlsRef.current = null;
    const stream = videoRef.current?.srcObject;
    if (stream instanceof MediaStream) stream.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  function closeScanner() {
    stopScanner();
    dialogRef.current?.close();
  }

  async function openScanner() {
    setError(null);
    dialogRef.current?.showModal();
    const session = sessionRef.current + 1;
    sessionRef.current = session;

    try {
      if (!navigator.mediaDevices?.getUserMedia || !videoRef.current) throw new Error("Camera unavailable");
      const { BrowserMultiFormatReader } = await import("@zxing/browser");
      const reader = new BrowserMultiFormatReader();
      const controls = await reader.decodeFromConstraints(
        { audio: false, video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } } },
        videoRef.current,
        (result, _error, activeControls) => {
          const value = result?.getText().trim();
          if (!value) return;
          activeControls.stop();
          onDetected(value);
          dialogRef.current?.close();
        },
      );
      if (sessionRef.current !== session) controls.stop();
      else controlsRef.current = controls;
    } catch (scanError) {
      if (sessionRef.current === session) setError(cameraErrorMessage(scanError));
    }
  }

  useEffect(() => () => stopScanner(), []);

  return <>
    <button aria-label="Scan serial-number barcode" className="grid h-control w-10 shrink-0 place-items-center rounded-r-md border border-l-0 border-border bg-zinc-50 text-muted hover:bg-zinc-100 hover:text-foreground" onClick={openScanner} title="Scan barcode with camera" type="button"><ScanLine className="size-4" /></button>
    {mounted && createPortal(
      <dialog className="m-auto w-[calc(100%-2rem)] max-w-lg rounded-lg border border-border bg-white p-0 text-foreground shadow-xl backdrop:bg-black/60" onClose={stopScanner} ref={dialogRef}>
        <header className="flex items-center justify-between border-b border-border bg-zinc-50 px-panel py-2.5"><div><h2 className="text-sm font-semibold">Scan serial number</h2><p className="text-2xs text-muted">Point the rear camera at the device barcode.</p></div><button aria-label="Close barcode scanner" className="grid size-7 place-items-center rounded-md text-muted hover:bg-zinc-100" onClick={closeScanner} type="button"><X className="size-4" /></button></header>
        <div className="p-3">
          <div className="relative overflow-hidden rounded-md border border-border bg-black">
            <video aria-label="Camera preview" autoPlay className="aspect-[4/3] w-full object-cover" muted playsInline ref={videoRef} />
            <div aria-hidden="true" className="pointer-events-none absolute inset-x-[10%] top-1/2 h-24 -translate-y-1/2 rounded-md border-2 border-amber-400 shadow-[0_0_0_999px_rgb(0_0_0/0.28)]" />
          </div>
          {error ? <p className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs font-medium text-red-700" role="alert">{error}</p> : <p className="mt-2 text-center text-2xs text-muted">The scanner closes automatically after reading a barcode.</p>}
        </div>
        <footer className="flex justify-end border-t border-border px-4 py-3"><button className="button-ghost border-border" onClick={closeScanner} type="button">Cancel</button></footer>
      </dialog>,
      document.body,
    )}
  </>;
}
