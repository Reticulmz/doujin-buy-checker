import type { BudgetSummary } from "~/services/budgetCalculator";

interface Props {
  summary: BudgetSummary;
}

export function BudgetBar(props: Props) {
  const pct = () =>
    props.summary.budget > 0
      ? Math.min((props.summary.totalPurchased / props.summary.budget) * 100, 100)
      : 0;

  const plannedPct = () =>
    props.summary.budget > 0
      ? Math.min((props.summary.totalPlanned / props.summary.budget) * 100, 100)
      : 0;

  const isOver = () => props.summary.remaining < 0;

  return (
    <div>
      <div class="flex justify-between text-sm mb-1.5 tabular-nums">
        <span class="font-medium">
          ¥{props.summary.totalPurchased.toLocaleString()}
          <span class="text-gray-400 font-normal"> / ¥{props.summary.budget.toLocaleString()}</span>
        </span>
        <span classList={{ "text-danger font-bold": isOver(), "text-gray-500": !isOver() }}>
          残 ¥{props.summary.remaining.toLocaleString()}
        </span>
      </div>
      <div class="relative h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        {/* Planned amount (lighter) */}
        <div
          class="absolute inset-y-0 left-0 rounded-full transition-all duration-500 bg-primary-200 dark:bg-primary-900/40"
          style={{ width: `${plannedPct()}%` }}
        />
        {/* Purchased amount (solid) */}
        <div
          class="absolute inset-y-0 left-0 rounded-full transition-all duration-500"
          classList={{
            "bg-primary-500": !isOver(),
            "bg-danger": isOver(),
          }}
          style={{ width: `${pct()}%` }}
        />
      </div>
      <div class="flex gap-3 mt-1 text-xs text-gray-400">
        <span class="flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-primary-500 inline-block" />
          購入済
        </span>
        <span class="flex items-center gap-1">
          <span class="w-2 h-2 rounded-full bg-primary-200 dark:bg-primary-900/40 inline-block" />
          予定
        </span>
      </div>
    </div>
  );
}
