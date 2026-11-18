import { NextResponse, type NextRequest } from "next/server";

// X ads link to "/?utm_source=x&…". Those visits get the X landing page (/x)
// in place of the home page. A rewrite, not a redirect: the URL and its ad
// tags stay as clicked, so attribution and X's click id are untouched, and
// live ads need no edit. Every other visit to "/" is the normal home page.
export function middleware(req: NextRequest) {
  if ((req.nextUrl.searchParams.get("utm_source") || "").toLowerCase() === "x") {
    const url = req.nextUrl.clone();
    url.pathname = "/x";
    return NextResponse.rewrite(url);
  }
  return NextResponse.next();
}

export const config = { matcher: "/" };
