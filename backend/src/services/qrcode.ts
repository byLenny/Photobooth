import QRCode from "qrcode";

export async function generateQrPng(url: string): Promise<Buffer> {
  return QRCode.toBuffer(url, { type: "png", margin: 1, width: 320 });
}
