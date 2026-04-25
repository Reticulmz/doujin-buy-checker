import { createSignal } from "solid-js";

export const ITEM_TYPES = [
  { value: "cd", label: "CD" },
  { value: "book", label: "本" },
  { value: "goods", label: "グッズ" },
  { value: "digital", label: "DL" },
  { value: "other", label: "他" },
];

export interface QuickAddItemResult {
  itemName: string;
  price: number;
  itemType: string;
  isNew: boolean;
  priority: 1 | 2 | 3;
  requestedBy: string;
}

interface Props {
  onAdd: (item: QuickAddItemResult) => void;
  onClose: () => void;
  defaults?: Partial<QuickAddItemResult>;
}

const PRIORITIES = [
  { value: 1, label: "必須" },
  { value: 2, label: "欲しい" },
  { value: 3, label: "余裕があれば" },
] as const;

export function QuickAddItemForm(props: Props) {
  const d = props.defaults ?? {};
  const [itemName, setItemName] = createSignal(d.itemName ?? "新刊");
  const [price, setPrice] = createSignal(d.price ?? 1000);
  const [itemType, setItemType] = createSignal(d.itemType ?? "cd");
  const [isNew, setIsNew] = createSignal(d.isNew ?? true);
  const [priority, setPriority] = createSignal<1 | 2 | 3>(d.priority ?? 2);
  const [requestedBy, setRequestedBy] = createSignal(d.requestedBy ?? "");

  const handleAdd = () => {
    if (!itemName().trim()) return;
    props.onAdd({
      itemName: itemName().trim(),
      price: price(),
      itemType: itemType(),
      isNew: isNew(),
      priority: priority(),
      requestedBy: requestedBy().trim(),
    });
    setItemName(d.itemName ?? "新刊");
    setPrice(d.price ?? 1000);
    setItemType(d.itemType ?? "cd");
    setIsNew(d.isNew ?? true);
    setPriority(d.priority ?? 2);
    setRequestedBy(d.requestedBy ?? "");
  };

  return (
    <div class="space-y-2">
      <div class="flex gap-2">
        <label class="sr-only" for="qa-item-name">品名</label>
        <input
          id="qa-item-name"
          type="text"
          class="input-field flex-1 text-sm !py-1.5"
          placeholder="品名"
          value={itemName()}
          onInput={(e) => setItemName(e.currentTarget.value)}
          autofocus
        />
        <div class="flex items-center gap-1">
          <span class="text-xs text-gray-500">¥</span>
          <label class="sr-only" for="qa-price">価格</label>
          <input
            id="qa-price"
            type="number"
            class="input-field !w-20 text-sm !py-1.5 tabular-nums text-right"
            value={price()}
            onInput={(e) => setPrice(Number(e.currentTarget.value) || 0)}
            min="0"
            step="100"
          />
        </div>
      </div>
      <div class="flex items-center gap-2 flex-wrap">
        <select
          class="input-field !py-1 text-xs !w-auto"
          value={itemType()}
          onChange={(e) => setItemType(e.currentTarget.value)}
          aria-label="種別"
        >
          {ITEM_TYPES.map((t) => <option value={t.value}>{t.label}</option>)}
        </select>
        <label class="flex items-center gap-1 text-xs cursor-pointer select-none">
          <input
            type="checkbox"
            class="w-3.5 h-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
            checked={isNew()}
            onChange={(e) => setIsNew(e.currentTarget.checked)}
          />
          <span class="text-danger font-bold">NEW</span>
        </label>
        <select
          class="input-field !py-1 text-xs !w-auto"
          value={priority()}
          onChange={(e) => setPriority(Number(e.currentTarget.value) as 1 | 2 | 3)}
          aria-label="優先度"
        >
          {PRIORITIES.map((p) => <option value={p.value}>{p.label}</option>)}
        </select>
        <input
          type="text"
          class="input-field !py-1 text-xs !w-16"
          placeholder="依頼者"
          aria-label="依頼者"
          value={requestedBy()}
          onInput={(e) => setRequestedBy(e.currentTarget.value)}
        />
        <button class="btn-primary text-xs !px-3 !py-1.5" onClick={handleAdd}>
          追加
        </button>
        <button
          class="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
          onClick={props.onClose}
        >
          閉じる
        </button>
      </div>
    </div>
  );
}
