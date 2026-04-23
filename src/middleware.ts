import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

/**
 * Public routes — anything NOT matched here requires a Clerk session.
 * Provider webhooks, channel ingest, and the marketing home / demo pages
 * must stay public.
 */
const isPublicRoute = createRouteMatcher([
  "/",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/login",
  "/register",
  "/admin/login",
  "/admin/bootstrap",
  "/demo(.*)",
  "/api/webhooks/(.*)",
  "/api/v1/(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (!isPublicRoute(req)) {
    await auth.protect();
  }
});

export const config = {
  matcher: [
    // Run on everything except Next internals and static asset file extensions.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API / tRPC routes.
    "/(api|trpc)(.*)",
  ],
};
