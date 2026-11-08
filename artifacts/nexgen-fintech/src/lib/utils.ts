/**
 * @fileoverview Shared utility functions for the Krediflo frontend.
 *
 * Keep this module lean — only pure, stateless helpers with no React
 * dependencies belong here.  Component-specific utilities should live next to
 * their component file.
 */

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * @description Merges Tailwind CSS class names, resolving conflicts intelligently.
 *
 * Combines `clsx` (which handles conditional class expressions, arrays, and
 * objects) with `tailwind-merge` (which de-duplicates and resolves conflicting
 * Tailwind utility classes, e.g. `p-2 p-4` → `p-4`).
 *
 * @param {...ClassValue[]} inputs - Any mix of strings, arrays, or objects that
 *   `clsx` accepts.  Falsy values and empty strings are safely ignored.
 * @returns {string} A single, deduplicated Tailwind class string.
 *
 * @example
 *   cn("px-4 py-2", isActive && "bg-teal-500", { "opacity-50": isDisabled })
 *   // → "px-4 py-2 bg-teal-500" (when isActive, !isDisabled)
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/* ─── PII masking helpers ─────────────────────────────────────────────────── */

/** Mask a PAN like ABCDE1234F → ABCDE****F (keeps first 5 + last char). */
export function maskPan(pan?: string | null): string {
  if (!pan) return "";
  const p = pan.trim().toUpperCase();
  if (p.length < 6) return "*".repeat(p.length);
  return p.slice(0, 5) + "*".repeat(p.length - 6) + p.slice(-1);
}

/** Mask an Aadhaar like 123456789012 → XXXX-XXXX-9012 (keeps last 4). */
export function maskAadhaar(aadhaar?: string | null): string {
  if (!aadhaar) return "";
  const digits = aadhaar.replace(/\D/g, "");
  if (digits.length < 4) return "X".repeat(digits.length);
  return "XXXX-XXXX-" + digits.slice(-4);
}

/** Mask a bank account number, keeping only the last 4 digits. */
export function maskAccountNumber(acct?: string | null): string {
  if (!acct) return "";
  const s = acct.trim();
  if (s.length < 4) return "*".repeat(s.length);
  return "*".repeat(Math.max(s.length - 4, 4)) + s.slice(-4);
}
