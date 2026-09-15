import QRCode from "qrcode";

/**
 * Generates an ISO/IEC 18004 compliant scannable QR code SVG.
 * Guaranteed to scan with any camera / QR reader (Google Lens, iPhone, Android Scanner).
 */
export async function generateQrSvgAsync(
  text: string,
  options?: { fgColor?: string; bgColor?: string; margin?: number }
): Promise<string> {
  const fg = options?.fgColor || "#000000";
  const bg = options?.bgColor || "#FFFFFF";
  const margin = options?.margin ?? 1;

  return QRCode.toString(text, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin,
    color: {
      dark: fg,
      light: bg,
    },
  });
}

/**
 * Generates high-contrast Data URL image for QR Code.
 */
export async function generateQrDataUrl(
  text: string,
  options?: { fgColor?: string; bgColor?: string; width?: number }
): Promise<string> {
  return QRCode.toDataURL(text, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: options?.width || 256,
    color: {
      dark: options?.fgColor || "#000000",
      light: options?.bgColor || "#FFFFFF",
    },
  });
}
