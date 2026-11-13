import qrcode from "qrcode-generator";

/** A real, scannable QR code drawn as SVG on the server (qrcode-generator, MIT). The text is the verify address. */
export function Qr({ text, size = 180, label }: { text: string; size?: number; label: string }) {
  const q = qrcode(0, "M");
  q.addData(text);
  q.make();
  const svg = q.createSvgTag({ cellSize: 4, margin: 4, scalable: true });
  return <div role="img" aria-label={label} style={{ width: size, height: size, background: "#fff", borderRadius: 8, overflow: "hidden" }} dangerouslySetInnerHTML={{ __html: svg }} />;
}
