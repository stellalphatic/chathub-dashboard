/**
 * Error classifiers used by the global / shell error boundaries.
 *
 * "Stale server action" happens after a redeploy: the user's browser still
 * has HTML referencing a Server Action ID from the *previous* build, but the
 * new server bundle has new IDs. Next.js reports it as
 * `Server Action "<hash>" was not found on the server.`
 *
 * The recovery is a single hard reload — the new HTML carries the new
 * action IDs and everything works again. Detecting it lets us reload
 * automatically instead of leaving the user stuck.
 */
export function isStaleServerActionError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const msg =
    typeof (error as { message?: unknown }).message === "string"
      ? ((error as { message: string }).message as string)
      : "";
  if (!msg) return false;
  return (
    msg.includes("Server Action") &&
    (msg.includes("was not found on the server") ||
      msg.includes("not found on the server"))
  );
}

/**
 * Attempt to extract a short, user-safe error message from anything thrown
 * inside a server component or server action. Falls back to a generic
 * message in production so we never leak stack traces or env hints.
 */
export function userMessageForError(
  error: unknown,
  fallback = "Something went wrong.",
): string {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  if (error instanceof Error) {
    if (process.env.NODE_ENV !== "production") return error.message || fallback;
    return error.message && error.message.length < 200
      ? error.message
      : fallback;
  }
  return fallback;
}
