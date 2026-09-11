import { z } from "zod";
import { zText, zOptionalText, zOptionalInt } from "@/lib/form";

export const TXN_TYPES = ["RECEIVE", "ISSUE", "ADJUST", "TRANSFER_IN", "TRANSFER_OUT"] as const;
export type TxnType = (typeof TXN_TYPES)[number];

export const TXN_LABELS: Record<string, string> = {
  RECEIVE: "Received",
  ISSUE: "Issued",
  ADJUST: "Adjusted",
  TRANSFER_IN: "Transfer in",
  TRANSFER_OUT: "Transfer out",
};

export const itemSchema = z.object({
  sku: zText.max(64),
  name: zText.max(200),
  unit: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v && v.length ? v : "ea")),
  categoryId: zOptionalText,
  defaultReorderPoint: zOptionalInt,
});

const qty = z
  .string()
  .trim()
  .transform((v) => Number(v))
  .refine((n) => Number.isFinite(n) && n > 0, "Enter a quantity greater than 0");

export const receiveSchema = z.object({
  itemId: zText,
  locationId: zText,
  quantity: qty,
  reason: zOptionalText,
});

export const issueSchema = receiveSchema;

export const adjustSchema = z.object({
  itemId: zText,
  locationId: zText,
  newCount: z
    .string()
    .trim()
    .transform((v) => Number(v))
    .refine((n) => Number.isInteger(n) && n >= 0, "Enter a whole number (0 or more)"),
  reason: zOptionalText,
});

export const transferSchema = z
  .object({
    itemId: zText,
    fromLocationId: zText,
    toLocationId: zText,
    quantity: qty,
    reason: zOptionalText,
  })
  .refine((d) => d.fromLocationId !== d.toLocationId, {
    message: "Pick two different locations",
    path: ["toLocationId"],
  });
