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
  "Family",
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

// Everything that counts as spending, split the way 50/30/20 splits it.
export const SPEND_CATEGORIES: Category[] = CATEGORIES.filter((c) => !NON_SPEND_CATEGORIES.includes(c));
export const WANTS_CATEGORIES: Category[] = SPEND_CATEGORIES.filter((c) => !NEEDS_CATEGORIES.includes(c));
