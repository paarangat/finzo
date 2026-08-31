import type { Category } from "./categories";

// Validated categorical palette (dataviz reference instance), light/dark steps.
// Color follows the category everywhere: donut, bars, legend. Never reassigned by rank.
const CATEGORY_COLORS: Partial<Record<Category, { light: string; dark: string }>> = {
  "Rent & Housing": { light: "#2a78d6", dark: "#3987e5" },
  "Food & Dining": { light: "#eb6834", dark: "#d95926" },
  Groceries: { light: "#1baf7a", dark: "#199e70" },
  Shopping: { light: "#eda100", dark: "#c98500" },
  Entertainment: { light: "#e87ba4", dark: "#d55181" },
  Health: { light: "#008300", dark: "#008300" },
  Subscriptions: { light: "#4a3aa7", dark: "#9085e9" },
  "Bills & Utilities": { light: "#e34948", dark: "#e66767" },
};

// Long-tail categories (Transport, Travel, Fees, Family, Other) share the neutral;
// they are always directly labeled, so identity never rides on hue alone.
const NEUTRAL = { light: "#898781", dark: "#898781" };
export const REMAINDER = "light-dark(#a1a1aa, #52525b)"; // the folded "everything else" slice

/** CSS color for a category, adapting to light/dark via light-dark(). */
export function categoryColor(category: string): string {
  const c = CATEGORY_COLORS[category as Category] ?? NEUTRAL;
  return `light-dark(${c.light}, ${c.dark})`;
}
