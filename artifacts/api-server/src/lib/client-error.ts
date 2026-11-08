/**
 * @fileoverview Client-safe error message helper.
 *
 * In production, raw upstream/vendor error text and internal exception
 * messages must never reach the browser. Route handlers should call
 * `clientErrorMessage(err, fallback)` when building error responses:
 * in development it returns the underlying message to aid debugging,
 * in production it returns the generic fallback only.
 */

const DEFAULT_FALLBACK =
  "Verification service temporarily unavailable. Please try again shortly.";

export function clientErrorMessage(
  err: unknown,
  fallback: string = DEFAULT_FALLBACK,
): string {
  if (process.env.NODE_ENV === "production") return fallback;
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return fallback;
}
