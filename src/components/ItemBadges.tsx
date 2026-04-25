import { Show } from "solid-js";
import { ITEM_TYPES } from "./QuickAddItemForm";

/** アイテム種別バッジ（CD, 本, グッズ等） */
export function ItemTypeBadge(props: { type: string }) {
  const label = () => ITEM_TYPES.find((t) => t.value === props.type)?.label ?? props.type;
  return (
    <Show when={props.type}>
      <span class="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
        {label()}
      </span>
    </Show>
  );
}

/** 新刊フラグバッジ */
export function NewBadge() {
  return (
    <span class="text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 font-bold">
      NEW
    </span>
  );
}
