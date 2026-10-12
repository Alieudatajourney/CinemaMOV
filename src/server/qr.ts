import "server-only";
import QRCode from "qrcode";
import { qrPayload } from "./core/tickets";

/** QR code (SVG markup) encoding only the opaque ticket token. */
export async function ticketQrSvg(ticketToken: string, opts: { dark?: string; light?: string } = {}) {
  return QRCode.toString(qrPayload(ticketToken), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: opts.dark ?? "#111111", light: opts.light ?? "#ffffff" },
  });
}
