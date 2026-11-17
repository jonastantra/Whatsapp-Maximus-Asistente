import { downloadMediaMessage, type WAMessage } from "baileys";
import { saveMessageImage } from "./db";

const LIMIT = 10 * 1024 * 1024;

export function imageMime(data: Buffer): string | null {
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.length >= 8 && data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return "image/png";
  if (data.length >= 12 && data.toString("ascii",0,4) === "RIFF" && data.toString("ascii",8,12) === "WEBP") return "image/webp";
  return null;
}

export async function guardarImagenWhatsApp(messageId: number, msg: WAMessage): Promise<void> {
  // No guardar imágenes que WhatsApp marca como de visualización única.
  const wrapped = msg.message?.ephemeralMessage?.message ?? msg.message;
  if (!wrapped || wrapped.viewOnceMessage || wrapped.viewOnceMessageV2 || wrapped.viewOnceMessageV2Extension) return;
  const image = wrapped.imageMessage;
  if (!image || image.viewOnce) return;
  const length = Number(image.fileLength ?? 0);
  if (length > LIMIT) throw new Error("Imagen excede el límite de 10 MB");
  const stream = await downloadMediaMessage(msg, "stream", {});
  const timer = setTimeout(() => stream.destroy(new Error("Tiempo de descarga agotado")), 30000);
  try {
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of stream) {
      const part = Buffer.from(chunk);
      size += part.length;
      if (size > LIMIT) { stream.destroy(); throw new Error("Imagen excede el límite de 10 MB"); }
      chunks.push(part);
    }
    const data = Buffer.concat(chunks);
    const mime = imageMime(data);
    if (!mime) throw new Error("Formato de imagen no admitido");
    saveMessageImage(messageId, mime, data);
  } finally { clearTimeout(timer); }
}
