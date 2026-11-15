// r23: the picture a member of the public sends with a problem report.
// Images only, size capped, and every metadata block that can carry a location (EXIF, XMP, text chunks, comments) is cut
// out before the file is stored. Pure byte surgery: no image library, no re-encode, the pixels are untouched.
// The phone form also redraws the picture on a canvas before upload, which drops metadata too; this is the server's own guarantee.

export const REPORT_PHOTO_MAX = 8_000_000;
export type PhotoKind = "jpg" | "png" | "webp";
export const PHOTO_TYPE: Record<PhotoKind, string> = { jpg: "image/jpeg", png: "image/png", webp: "image/webp" };

/** What the bytes really are, from their first bytes, never from the name or the browser's claim. */
export function sniff(b: Uint8Array): PhotoKind | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "jpg";
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "png";
  if (b.length > 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 4) === "WEBP") return "webp";
  return null;
}
const ascii = (b: Uint8Array, at: number, n: number) => String.fromCharCode(...b.subarray(at, at + n));
const cat = (parts: Uint8Array[]) => { const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0)); let o = 0; for (const p of parts) { out.set(p, o); o += p.length; } return out; };

/** JPEG: keep APP0 (JFIF) and APP14 (Adobe colour), drop every other APPn (EXIF and XMP live in APP1) and every comment. */
function stripJpeg(b: Uint8Array): Uint8Array | null {
  const keep: Uint8Array[] = [b.subarray(0, 2)];
  let i = 2;
  while (i + 4 <= b.length) {
    if (b[i] !== 0xff) return null;
    const m = b[i + 1];
    if (m === 0xff) { i++; continue; } // fill byte
    if (m === 0xda) { keep.push(b.subarray(i)); return cat(keep); } // start of scan: the rest is image data
    if (m === 0xd9) { keep.push(b.subarray(i, i + 2)); return cat(keep); }
    const len = (b[i + 2] << 8) | b[i + 3];
    if (len < 2 || i + 2 + len > b.length) return null;
    const isApp = m >= 0xe0 && m <= 0xef;
    const drop = (isApp && m !== 0xe0 && m !== 0xee) || m === 0xfe;
    if (!drop) keep.push(b.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  return null;
}

/** PNG: drop the chunks that carry metadata. Pixels, palette and colour chunks stay. */
const PNG_DROP = new Set(["eXIf", "tEXt", "zTXt", "iTXt", "tIME"]);
function stripPng(b: Uint8Array): Uint8Array | null {
  const keep: Uint8Array[] = [b.subarray(0, 8)];
  let i = 8;
  while (i + 12 <= b.length) {
    const len = ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    const type = ascii(b, i + 4, 4);
    const end = i + 12 + len;
    if (end > b.length) return null;
    if (!PNG_DROP.has(type)) keep.push(b.subarray(i, end));
    i = end;
    if (type === "IEND") return cat(keep);
  }
  return null;
}

/** WebP: drop the EXIF and XMP chunks and clear their flags in the VP8X header, then fix the RIFF size. */
function stripWebp(b: Uint8Array): Uint8Array | null {
  const keep: Uint8Array[] = [];
  let i = 12;
  while (i + 8 <= b.length) {
    const type = ascii(b, i, 4);
    const len = (b[i + 4] | (b[i + 5] << 8) | (b[i + 6] << 16) | (b[i + 7] << 24)) >>> 0;
    const end = i + 8 + len + (len & 1);
    if (i + 8 + len > b.length) return null;
    if (type === "VP8X") { const c = b.slice(i, Math.min(end, b.length)); c[8] &= ~(0x08 | 0x04); keep.push(c); } // EXIF flag 0x08, XMP flag 0x04
    else if (type !== "EXIF" && type !== "XMP ") keep.push(b.subarray(i, Math.min(end, b.length)));
    i = end;
  }
  const body = cat(keep);
  const head = new Uint8Array(12);
  head.set(b.subarray(0, 12));
  const size = body.length + 4;
  head[4] = size & 0xff; head[5] = (size >> 8) & 0xff; head[6] = (size >> 16) & 0xff; head[7] = (size >>> 24) & 0xff;
  return cat([head, body]);
}

export type Cleaned = { ok: true; kind: PhotoKind; bytes: Uint8Array } | { ok: false; error: string };
/** Check a sent picture and cut out its metadata. Refuses anything that is not a whole JPEG, PNG or WebP under the cap. */
export function cleanPhoto(b: Uint8Array): Cleaned {
  if (b.length === 0) return { ok: false, error: "Add a picture of the machine" };
  if (b.length > REPORT_PHOTO_MAX) return { ok: false, error: "That picture is over 8 MB. Try a smaller one." };
  const kind = sniff(b);
  if (!kind) return { ok: false, error: "Use a JPEG, PNG or WebP picture" };
  const bytes = kind === "jpg" ? stripJpeg(b) : kind === "png" ? stripPng(b) : stripWebp(b);
  if (!bytes) return { ok: false, error: "That picture could not be read. Try taking it again." };
  return { ok: true, kind, bytes };
}
