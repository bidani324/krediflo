/**
 * @fileoverview Public API for the @workspace/api-zod library.
 *
 * Exports all Orval-generated Zod validation schemas from the OpenAPI contract.
 * TypeScript types for every schema are inferred automatically via `z.infer<>`,
 * so callers do not need separate type imports — the Zod schemas serve as both
 * runtime validators and compile-time types.
 *
 * The generated `types/` directory is intentionally NOT re-exported here:
 * it conflicts with the Zod schema names (both use the same identifiers) and
 * is redundant because `z.infer<typeof Schema>` provides equivalent types.
 */

export * from "./generated/api";
