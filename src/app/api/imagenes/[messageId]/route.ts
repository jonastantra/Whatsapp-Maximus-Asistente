import { NextResponse } from "next/server";
import { getMessageImage } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: {params: Promise<{messageId:string}>}) {
  const id = Number((await context.params).messageId);
  if (!Number.isSafeInteger(id) || id <= 0) return new NextResponse(null,{status:404});
  const image = getMessageImage(id);
  if (!image) return new NextResponse(null,{status:404});
  return new NextResponse(new Uint8Array(image.data), {headers:{
    "Content-Type":image.mime,
    "Cache-Control":"private, no-store",
    "X-Content-Type-Options":"nosniff",
    "Content-Security-Policy":"default-src 'none'",
  }});
}
