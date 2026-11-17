import { NextRequest, NextResponse } from "next/server";

// Browser mutations require a same-origin request; basic authentication alone
// does not protect against a third-party website submitting a form.
export function proxy(request: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return NextResponse.next();
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  try {
    if (origin && host && new URL(origin).host === host) return NextResponse.next();
  } catch { /* reject malformed origins */ }
  return NextResponse.json({ error: "Origen no permitido" }, { status: 403 });
}

export const config = { matcher: "/api/:path*" };
