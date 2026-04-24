import type { BuyListItem } from "~/db/schema";

export interface BudgetSummary {
  budget: number;
  totalPlanned: number;
  totalPurchased: number;
  remaining: number;
  byPriority: {
    priority: 1 | 2 | 3;
    label: string;
    total: number;
    purchased: number;
  }[];
}

const PRIORITY_LABELS: Record<number, string> = {
  1: "必須",
  2: "欲しい",
  3: "余裕があれば",
};

export function calculateBudget(items: BuyListItem[], budget: number): BudgetSummary {
  const byPriority = ([1, 2, 3] as const).map((p) => {
    const filtered = items.filter((i) => i.priority === p);
    return {
      priority: p,
      label: PRIORITY_LABELS[p],
      total: filtered.reduce((sum, i) => sum + i.price * i.quantity, 0),
      purchased: filtered
        .filter((i) => i.purchased)
        .reduce((sum, i) => sum + i.price * i.quantity, 0),
    };
  });

  const totalPlanned = byPriority.reduce((sum, p) => sum + p.total, 0);
  const totalPurchased = byPriority.reduce((sum, p) => sum + p.purchased, 0);

  return {
    budget,
    totalPlanned,
    totalPurchased,
    remaining: budget - totalPurchased,
    byPriority,
  };
}
