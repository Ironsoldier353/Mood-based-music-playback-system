import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher([
    "/",
    "/sign-in",
    "/sign-up",
])


export default clerkMiddleware(async (auth, req) => {
  const url = req.nextUrl.clone();
  const pathname = url.pathname;
  const { userId } = await auth();

  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  const isProtected =
    pathname === "/onboarding" ||
    pathname === "/mood"  ||
    pathname === "/home" ;

  if (!userId && isProtected) {
    url.pathname = "/sign-in";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!.+\\.[\\w]+$|_next|static|favicon.ico).*)',
  ],
};