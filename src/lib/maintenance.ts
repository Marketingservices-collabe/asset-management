import { z } from "zod";
import { zText, zOptionalText, zOptionalDecimal, zOptionalInt } from "@/lib/form";

export const MAINT_STATUSES = ["SCHEDULED", "OVERDUE", "DONE", "SKIPPED"] as const;
export type MaintStatus = (typeof MAINT_STATUSES)[number];

export const scheduleSchema = z.object({
  assetId: zText,
  title: zText.max(200),
  intervalDays: z
    .string()
    .trim()
    .transform((v) => Number(v))
    .refine((v) => Number.isInteger(v) && v > 0, "Enter a whole number of days greater than 0"),
  firstDueAt: z
    .string()
    .trim()
    .transform((v) => new Date(v))
    .refine((v) => !Number.isNaN(v.getTime()), "Pick a valid date"),
  leadDays: zOptionalInt,
  assignedToPersonId: zOptionalText,
  active: z
    .union([z.literal("on"), z.literal("true"), z.undefined()])
    .transform((v) => v === "on" || v === "true"),
});

export type ScheduleInput = z.infer<typeof scheduleSchema>;

export const completeSchema = z.object({
  recordId: zText,
  completedAt: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? new Date(v) : new Date()))
    .refine((v) => !Number.isNaN(v.getTime()), "Invalid date"),
  technician: zOptionalText,
  workPerformed: zOptionalText,
  cost: zOptionalDecimal,
});

export const adHocSchema = z.object({
  assetId: zText,
  completedAt: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? new Date(v) : new Date()))
    .refine((v) => !Number.isNaN(v.getTime()), "Invalid date"),
  technician: zOptionalText,
  workPerformed: zText.max(2000),
  cost: zOptionalDecimal,
});

/** Next occurrence = base + intervalDays. */
export function addDays(base: Date, days: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + days);
  return d;
}

/** Display status: a scheduled record past its due date reads as overdue. */
export function effectiveStatus(status: string, dueAt: Date | null): MaintStatus {
  if (status === "SCHEDULED" && dueAt && dueAt.getTime() < Date.now()) return "OVERDUE";
  return status as MaintStatus;
}
