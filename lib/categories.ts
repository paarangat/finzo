export const CATEGORIES = [
  "Food & Dining",
  "Groceries",
  "Transport",
  "Shopping",
  "Bills & Utilities",
  "Rent & Housing",
  "Subscriptions",
  "Entertainment",
  "Health",
  "Travel",
  "Fees",
  "Transfers",
  "Income",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

// Excluded from spend/income totals and charts: moving money isn't spending it.
export const NON_SPEND_CATEGORIES: Category[] = ["Transfers", "Income"];

// "Needs" for the 50/30/20 rule of thumb; every other spend category counts as a want.
export const NEEDS_CATEGORIES: Category[] = ["Groceries", "Transport", "Bills & Utilities", "Rent & Housing", "Health", "Fees"];
