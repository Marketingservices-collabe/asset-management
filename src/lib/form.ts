import { z } from "zod";

export type FormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  /** transient values to repopulate the form on error */
  values?: Record<string, string>;
};

export const EMPTY_FORM_STATE: FormState = {};

/** Parse a FormData against a Zod schema, returning a discriminated result. */
export function parseForm<S extends z.ZodType>(
  schema: S,
  formData: FormData,
): { success: true; data: z.infer<S> } | { success: false; state: FormState } {
  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("$ACTION")) continue;
    if (value === "") {
      raw[key] = undefined;
      continue;
    }
    raw[key] = value;
  }

  const parsed = schema.safeParse(raw);
  if (parsed.success) return { success: true, data: parsed.data };

  const values: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") values[k] = v;
  }

  return {
    success: false,
    state: {
      error: "Please fix the highlighted fields.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
      values,
    },
  };
}

/** Common coercions */
export const zText = z.string().trim().min(1, "Required");
export const zOptionalText = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v === "" ? undefined : v));
export const zOptionalEmail = z
  .string()
  .trim()
  .email("Invalid email")
  .optional()
  .or(z.literal("").transform(() => undefined));
export const zOptionalUrl = z
  .string()
  .trim()
  .url("Must be a valid URL (https://…)")
  .optional()
  .or(z.literal("").transform(() => undefined));
export const zOptionalDecimal = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v == null || v === "" ? undefined : v))
  .refine((v) => v === undefined || !Number.isNaN(Number(v)), "Must be a number");
export const zOptionalInt = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v == null || v === "" ? undefined : Number(v)))
  .refine((v) => v === undefined || Number.isInteger(v), "Must be a whole number");
export const zOptionalDate = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v == null || v === "" ? undefined : new Date(v)))
  .refine((v) => v === undefined || !Number.isNaN(v.getTime()), "Invalid date");
