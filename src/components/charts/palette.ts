/** Small categorical palette. Brand first, then distinct accents that work in both themes. */
export const CHART_COLORS = [
  "#ee5566", // brand
  "#3b82f6", // blue
  "#f59e0b", // amber
  "#10b981", // emerald
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#14b8a6", // teal
  "#64748b", // slate
];

export const STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "#10b981",
  CHECKED_OUT: "#f59e0b",
  LEASED: "#3b82f6",
  RESERVED: "#8b5cf6",
  UNDER_REPAIR: "#fb923c",
  DISPOSED: "#94a3b8",
  LOST: "#ef4444",
};

export function colorAt(i: number) {
  return CHART_COLORS[i % CHART_COLORS.length];
}
