/**
 * Pure depreciation helpers. All money in plain numbers (caller converts Prisma.Decimal).
 * Periods are monthly.
 */

export type DepMethod =
  | "STRAIGHT_LINE"
  | "DECLINING_BALANCE_200"
  | "DECLINING_BALANCE_150"
  | "SUM_OF_YEARS_DIGITS"
  | "NONE";

export type DepInput = {
  cost: number;
  salvage: number;
  usefulLifeMonths: number;
  method: DepMethod;
};

export type DepPeriod = { month: number; expense: number; accumulated: number; bookValue: number };

export function buildSchedule({ cost, salvage, usefulLifeMonths, method }: DepInput): DepPeriod[] {
  if (method === "NONE" || usefulLifeMonths <= 0 || cost <= salvage) return [];
  const depreciableBase = cost - salvage;
  const rows: DepPeriod[] = [];
  let bookValue = cost;
  let accumulated = 0;

  for (let m = 1; m <= usefulLifeMonths; m++) {
    let expense = 0;

    if (method === "STRAIGHT_LINE") {
      expense = depreciableBase / usefulLifeMonths;
    } else if (method === "DECLINING_BALANCE_200" || method === "DECLINING_BALANCE_150") {
      const factor = method === "DECLINING_BALANCE_200" ? 2 : 1.5;
      const monthlyRate = factor / usefulLifeMonths;
      expense = bookValue * monthlyRate;
      // don't depreciate below salvage
      if (bookValue - expense < salvage) expense = bookValue - salvage;
    } else if (method === "SUM_OF_YEARS_DIGITS") {
      // month-level SYD: weight remaining months
      const sumOfMonths = (usefulLifeMonths * (usefulLifeMonths + 1)) / 2;
      const remaining = usefulLifeMonths - m + 1;
      expense = (depreciableBase * remaining) / sumOfMonths;
    }

    // final month: true up any rounding drift
    if (m === usefulLifeMonths) expense = bookValue - salvage;

    expense = round2(Math.max(expense, 0));
    accumulated = round2(accumulated + expense);
    bookValue = round2(cost - accumulated);
    rows.push({ month: m, expense, accumulated, bookValue });
  }

  return rows;
}

export function bookValueAsOf(input: DepInput, monthsElapsed: number): number {
  const schedule = buildSchedule(input);
  if (schedule.length === 0) return input.cost;
  if (monthsElapsed <= 0) return input.cost;
  const idx = Math.min(monthsElapsed, schedule.length) - 1;
  return schedule[idx].bookValue;
}

function round2(n: number) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
