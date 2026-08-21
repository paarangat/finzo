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
