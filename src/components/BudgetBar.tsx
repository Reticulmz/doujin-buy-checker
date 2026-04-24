import type { BudgetSummary } from "~/services/budgetCalculator";

interface Props {
  summary: BudgetSummary;
}

export function BudgetBar(props: Props) {
  const pct = () =>
    props.summary.budget > 0
      ? Math.min((props.summary.totalPurchased / props.summary.budget) * 100, 100)
      : 0;

  const isOver = () => props.summary.remaining < 0;

  return (
    <div>
      <div class="flex justify-between text-xs mb-1">
        <span>
          購入済 ¥{props.summary.totalPurchased.toLocaleString()} / ¥
          {props.summary.budget.toLocaleString()}
        </span>
        <span classList={{ "text-red-500 font-bold": isOver() }}>
          残り ¥{props.summary.remaining.toLocaleString()}
        </span>
      </div>
      <div class="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          class="h-full rounded-full transition-all duration-300"
          classList={{
            "bg-primary-500": !isOver(),
            "bg-red-500": isOver(),
          }}
          style={{ width: `${pct()}%` }}
        />
      </div>
    </div>
  );
}
