"use client";
import { useEffect, useRef, useState } from "react";

type Detector = { detect(v: HTMLVideoElement): Promise<{ rawValue: string }[]> };

/** Camera scan of a machine label: browser BarcodeDetector first, @zxing/browser second, typing always works. */
export function BarcodeScan({ onCode }: { onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const stopRef = useRef<() => void>(() => {});
  const [on, setOn] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => () => stopRef.current(), []);

  async function start() {
    setMsg(""); setOn(true);
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | null = null;
    let zxingStop: (() => void) | null = null;
    const stop = () => { if (timer) clearInterval(timer); zxingStop?.(); stream?.getTracks().forEach((t) => t.stop()); setOn(false); };
    stopRef.current = stop;
    const done = (code: string) => { stop(); onCode(code); setMsg("Scanned. Check the fields below."); };
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
      const v = video.current!;
      v.srcObject = stream;
      await v.play();
      const BD = (window as unknown as { BarcodeDetector?: new () => Detector }).BarcodeDetector;
      if (BD) {
        const det = new BD();
        timer = setInterval(async () => { try { const r = await det.detect(v); if (r[0]?.rawValue) done(r[0].rawValue); } catch { /* keep trying */ } }, 300);
      } else {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        const controls = await reader.decodeFromVideoElement(v, (res) => { if (res) done(res.getText()); });
        zxingStop = () => controls.stop();
      }
    } catch {
      stop();
      setMsg("The camera did not open (it needs https or localhost, and your permission). Type the code instead.");
    }
  }

  return (
    <div className="scanbox">
      <div className="actions" style={{ marginTop: 0 }}>
        {!on ? <button type="button" className="btn gild" onClick={start}>Scan the machine&apos;s label</button> : <button type="button" className="btn" onClick={() => stopRef.current()}>Stop the camera</button>}
      </div>
      <video ref={video} className="scanvideo" playsInline muted style={{ display: on ? "block" : "none" }} />
      {msg && <p className="muted small" role="status">{msg}</p>}
    </div>
  );
}
