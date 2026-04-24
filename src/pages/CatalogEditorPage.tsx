import { createSignal, createMemo, onMount, For, Show, onCleanup } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Portal } from "solid-js/web";
import { ulid } from "ulidx";
import { type EventType, type StoredCatalog, db } from "~/db/schema";
import { useSearchParams, useNavigate } from "@solidjs/router";
import { useLiveQuery } from "~/hooks/useLiveQuery";
import { EVENT_PRESETS, validateSpace, inferM3Hall } from "~/services/eventPresets";

interface CatalogItem {
  name: string;
  price: number;
  type: string;
  isNew: boolean;
}

interface CatalogCircle {
  id: string;
  name: string;
  author: string;
  space: { block: string; hall: string; number: number; sub: string; raw: string };
  genre: string;
  urls: { website: string; twitter: string; pixiv: string };
  items: CatalogItem[];
  tags: string[];
}

interface CatalogData {
  schemaVersion: string;
  catalog: { id: string; name: string; publisher: string; publishedAt: string; updatedAt: string };
  event: { name: string; date: string; venue: string; dayNumber: number };
  circles: CatalogCircle[];
}

type Step = 0 | 1 | 2;

const STEPS = [
  { label: "イベント", short: "1" },
  { label: "サークル & 頒布物", short: "2" },
  { label: "確認", short: "3" },
] as const;

const ITEM_TYPES = [
  { value: "cd", label: "CD" },
  { value: "book", label: "本" },
  { value: "goods", label: "グッズ" },
  { value: "digital", label: "DL" },
  { value: "other", label: "他" },
];

function emptyCircle(): CatalogCircle {
  return {
    id: `circle-${ulid()}`, name: "", author: "",
    space: { block: "", hall: "", number: 0, sub: "", raw: "" },
    genre: "", urls: { website: "", twitter: "", pixiv: "" }, items: [], tags: [],
  };
}

function emptyItem(): CatalogItem {
  return { name: "", price: 0, type: "cd", isNew: true };
}

function Cell(props: { value: string; onInput: (v: string) => void; placeholder?: string; type?: string; class?: string; min?: string; step?: string }) {
  return (
    <input
      type={props.type ?? "text"}
      class={`w-full bg-transparent border-0 outline-none px-2 py-1.5 text-sm placeholder:text-gray-300 dark:placeholder:text-gray-600 focus:bg-primary-50/50 dark:focus:bg-primary-900/20 transition-colors ${props.class ?? ""}`}
      value={props.value} placeholder={props.placeholder}
      onInput={(e) => props.onInput(e.currentTarget.value)}
      min={props.min} step={props.step}
    />
  );
}

export default function CatalogEditorPage() {
  const [mode, setMode] = createSignal<"list" | "edit">("list");
  const [step, setStep] = createSignal<Step>(0);
  const [catalogId, setCatalogId] = createSignal<string | null>(null);
  const [eventType, setEventType] = createSignal<EventType>("m3");
  const [eventName, setEventName] = createSignal("");
  const [eventDate, setEventDate] = createSignal("");
  const [eventVenue, setEventVenue] = createSignal("");
  const [publisherName, setPublisherName] = createSignal("");
  const [saveStatus, setSaveStatus] = createSignal("");

  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const storedCatalogs = useLiveQuery(() =>
    db.storedCatalogs.orderBy("updatedAt").reverse().filter((c) => c.isDraft).toArray()
  );

  // Load from URL param ?id=xxx
  onMount(async () => {
    const id = searchParams.id;
    if (!id) return;
    const stored = await db.storedCatalogs.get(id);
    if (stored) {
      loadCatalogJson(stored.data);
      setCatalogId(stored.id);
      setMode("edit");
      setStep(hasEventInfo() ? 1 : 0);
    }
  });

  const hasEventInfo = () => eventName().trim().length > 0 && eventDate().length > 0;

  const changeEventType = (type: EventType) => {
    setEventType(type);
    const preset = EVENT_PRESETS[type];
    if (preset.venue) setEventVenue(preset.venue);
  };
  const [circles, setCircles] = createStore<CatalogCircle[]>([]);
  const [modalCircleIndex, setModalCircleIndex] = createSignal<number | null>(null);
  const [copied, setCopied] = createSignal(false);

  // --- Serialize editor state to catalog JSON ---
  const buildCatalogJson = () => JSON.stringify({
    schemaVersion: "1.0.0",
    catalog: { id: `catalog-${ulid()}`, name: eventName(), publisher: publisherName(), publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
    event: { name: eventName(), date: eventDate(), venue: eventVenue(), dayNumber: 1 },
    circles: [...circles],
    _editorMeta: { eventType: eventType() },
  }, null, 2);

  const loadCatalogJson = (json: string) => {
    const data = JSON.parse(json);
    setEventType(data._editorMeta?.eventType ?? (data.event?.venue?.includes("流通センター") ? "m3" : "custom"));
    setEventName(data.event?.name ?? data.eventName ?? "");
    setEventDate(data.event?.date ?? data.eventDate ?? "");
    setEventVenue(data.event?.venue ?? data.eventVenue ?? "");
    setPublisherName(data.catalog?.publisher ?? data.publisherName ?? "");
    const importedCircles: CatalogCircle[] = (data.circles ?? []).map((c: any) => ({
      id: c.id || `circle-${ulid()}`, name: c.name ?? "", author: c.author ?? "",
      space: { block: c.space?.block ?? "", hall: c.space?.hall ?? "", number: c.space?.number ?? 0, sub: c.space?.sub ?? "", raw: c.space?.raw ?? "" },
      genre: c.genre ?? "",
      urls: { website: c.urls?.website ?? "", twitter: c.urls?.twitter ?? "", pixiv: c.urls?.pixiv ?? "" },
      items: Array.isArray(c.items) ? c.items.map((it: any) => ({ name: it.name ?? "", price: it.price ?? 0, type: it.type ?? "other", isNew: it.isNew ?? false })) : [],
      tags: Array.isArray(c.tags) ? c.tags : [],
    }));
    setCircles(importedCircles);
  };

  const saveCatalog = async () => {
    const now = new Date().toISOString();
    const name = eventName().trim() || "無題のカタログ";
    const data = buildCatalogJson();
    const id = catalogId();

    if (id) {
      await db.storedCatalogs.update(id, {
        name, eventName: eventName(), eventDate: eventDate(), eventVenue: eventVenue(),
        eventType: eventType(), circleCount: circles.length, data, updatedAt: now,
      });
    } else {
      const newId = ulid();
      await db.storedCatalogs.add({
        id: newId, name, eventName: eventName(), eventDate: eventDate(), eventVenue: eventVenue(),
        eventType: eventType(), circleCount: circles.length, data, isDraft: true,
        sourceUrl: null, createdAt: now, updatedAt: now,
      });
      setCatalogId(newId);
    }
    setSaveStatus("保存しました");
    setTimeout(() => setSaveStatus(""), 2000);
  };

  const loadStoredCatalog = (catalog: StoredCatalog) => {
    loadCatalogJson(catalog.data);
    setCatalogId(catalog.id);
    setMode("edit");
    setStep(hasEventInfo() ? 1 : 0);
  };

  const deleteStoredCatalog = async (id: string) => {
    if (confirm("この下書きを削除しますか？")) {
      await db.storedCatalogs.delete(id);
      if (catalogId() === id) setCatalogId(null);
    }
  };

  const startNew = () => {
    setCatalogId(null);
    setEventType("m3");
    setEventName("");
    setEventDate("");
    setEventVenue("");
    setPublisherName("");
    setCircles([]);
    setStep(0);
    setMode("edit");
  };

  const loadFromFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        startNew();
        loadCatalogJson(await file.text());
        setStep(hasEventInfo() ? 1 : 0);
      } catch { alert("JSONの読み込みに失敗しました"); }
    };
    input.click();
  };

  // --- Data helpers (fine-grained store updates) ---
  const updateCircle = (index: number, field: string, value: string) => {
    if (field === "name" || field === "author" || field === "genre") {
      setCircles(index, field as keyof CatalogCircle, value as any);
    } else if (field === "spaceRaw") {
      setCircles(index, "space", "raw", value);
    } else if (field === "twitter") {
      setCircles(index, "urls", "twitter", value);
    }
  };

  const removeCircle = (index: number) => {
    if (modalCircleIndex() === index) setModalCircleIndex(null);
    setCircles(produce((c) => c.splice(index, 1)));
  };

  const addItem = (ci: number) => {
    setCircles(ci, "items", (items) => [...items, emptyItem()]);
  };

  const updateItem = (ci: number, ii: number, field: keyof CatalogItem, value: string | number | boolean) => {
    setCircles(ci, "items", ii, field, value as any);
  };

  const removeItem = (ci: number, ii: number) => {
    setCircles(ci, "items", produce((items) => items.splice(ii, 1)));
  };

  // --- Import ---
  const handleJsonImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        if (data.event) {
          if (!eventName()) setEventName(data.event.name ?? "");
          if (!eventDate()) setEventDate(data.event.date ?? "");
          if (!eventVenue()) setEventVenue(data.event.venue ?? "");
        }
        if (data.catalog && !publisherName()) setPublisherName(data.catalog.publisher ?? "");
        if (Array.isArray(data.circles)) {
          const imported: CatalogCircle[] = data.circles.map((c: any) => ({
            id: c.id || `circle-${ulid()}`, name: c.name ?? "", author: c.author ?? "",
            space: { block: c.space?.block ?? "", hall: c.space?.hall ?? "", number: c.space?.number ?? 0, sub: c.space?.sub ?? "", raw: c.space?.raw ?? "" },
            genre: c.genre ?? "",
            urls: { website: c.urls?.website ?? "", twitter: c.urls?.twitter ?? "", pixiv: c.urls?.pixiv ?? "" },
            items: Array.isArray(c.items) ? c.items.map((it: any) => ({ name: it.name ?? "", price: it.price ?? 0, type: it.type ?? "other", isNew: it.isNew ?? false })) : [],
            tags: Array.isArray(c.tags) ? c.tags : [],
          }));
          setCircles(produce((c) => c.push(...imported)));
        }
      } catch { alert("JSONの読み込みに失敗しました"); }
    };
    input.click();
  };

  const handleCsvImport = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".csv,.tsv";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      const text = await file.text();
      const lines = text.split("\n").filter((l) => l.trim());
      const sep = text.includes("\t") ? "\t" : ",";
      const imported: CatalogCircle[] = lines.slice(1).map((line) => {
        const cols = line.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
        return { ...emptyCircle(), name: cols[0] || "", author: cols[1] || "", space: { block: "", hall: "", number: 0, sub: "", raw: cols[2] || "" }, genre: cols[3] || "", urls: { website: cols[4] || "", twitter: "", pixiv: "" } };
      });
      setCircles(produce((c) => c.push(...imported)));
    };
    input.click();
  };

  // --- Export ---
  const exportJson = () => {
    const json = buildCatalogJson();
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `catalog-${eventDate() || "draft"}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(buildCatalogJson());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // --- Sorting ---
  type SortKey = "index" | "name" | "space" | "hall" | "genre";
  const [sortKey, setSortKey] = createSignal<SortKey>("index");
  const [sortAsc, setSortAsc] = createSignal(true);

  const toggleSort = (key: SortKey) => {
    if (sortKey() === key) {
      setSortAsc(!sortAsc());
    } else {
      setSortKey(key);
      setSortAsc(true);
    }
  };

  const sortedIndices = createMemo(() => {
    const indices = Array.from({ length: circles.length }, (_, i) => i);
    const key = sortKey();
    if (key === "index") return sortAsc() ? indices : indices.reverse();

    indices.sort((a, b) => {
      let va = "", vb = "";
      if (key === "name") { va = circles[a].name; vb = circles[b].name; }
      else if (key === "space") { va = circles[a].space.raw; vb = circles[b].space.raw; }
      else if (key === "hall") { va = inferM3Hall(circles[a].space.raw); vb = inferM3Hall(circles[b].space.raw); }
      else if (key === "genre") { va = circles[a].genre; vb = circles[b].genre; }
      return va.localeCompare(vb, "ja");
    });
    return sortAsc() ? indices : indices.reverse();
  });

  const sortIndicator = (key: SortKey) =>
    sortKey() === key ? (sortAsc() ? " ▲" : " ▼") : "";

  // --- Validation & nav ---
  const canProceed = createMemo(() => {
    if (step() === 0) return eventName().trim().length > 0 && eventDate().length > 0;
    if (step() === 1) return circles.length > 0 && circles.every((c) => c.name.trim());
    return true;
  });
  const totalItems = createMemo(() => circles.reduce((sum, c) => sum + c.items.length, 0));
  const next = () => { if (step() < 2 && canProceed()) setStep((s) => (s + 1) as Step); };
  const prev = () => { if (step() > 0) setStep((s) => (s - 1) as Step); };

  // --- Keyboard: Escape closes modal ---
  const handleKeydown = (e: KeyboardEvent) => { if (e.key === "Escape") setModalCircleIndex(null); };
  if (typeof window !== "undefined") {
    window.addEventListener("keydown", handleKeydown);
    onCleanup(() => window.removeEventListener("keydown", handleKeydown));
  }

  // --- Styles ---
  const th = "px-2 py-1.5 text-[11px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider text-left bg-gray-50 dark:bg-gray-800/80 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-1";
  const td = "border-b border-gray-100 dark:border-gray-800 relative";
  const rowHover = "group hover:bg-primary-50/30 dark:hover:bg-primary-900/10 transition-colors";

  return (
    <div class="max-w-2xl mx-auto min-h-screen flex flex-col pb-20">
      {/* ===== Draft list mode ===== */}
      <Show when={mode() === "list"}>
        <div class="p-4 space-y-4">
          <div class="flex items-center justify-between">
            <h1 class="text-xl font-bold">カタログ作成</h1>
          </div>

          <div class="flex gap-2">
            <button class="btn-primary flex-1" onClick={startNew}>新規作成</button>
            <button class="btn-secondary flex-1" onClick={loadFromFile}>JSONから開く</button>
          </div>

          <Show when={storedCatalogs() && storedCatalogs()!.length > 0}>
            <h2 class="font-bold text-sm mt-2">保存済みの下書き</h2>
            <div class="space-y-2">
              <For each={storedCatalogs()}>
                {(draft) => (
                  <div class="card !p-3 flex items-center justify-between">
                    <button class="flex-1 text-left min-w-0" onClick={() => loadStoredCatalog(draft)}>
                      <div class="font-medium truncate">{draft.name}</div>
                      <div class="text-xs text-gray-500 mt-0.5">
                        <Show when={draft.eventType !== "custom"}>
                          <span class="uppercase mr-2">{draft.eventType}</span>
                        </Show>
                        更新: {new Date(draft.updatedAt).toLocaleString("ja-JP")}
                      </div>
                    </button>
                    <button
                      class="text-gray-400 hover:text-red-500 p-2"
                      onClick={() => deleteStoredCatalog(draft.id)}
                    >✕</button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={!storedCatalogs() || storedCatalogs()!.length === 0}>
            <div class="text-center text-gray-500 py-8">
              <p>保存済みの下書きはありません</p>
              <p class="text-sm mt-1">「新規作成」で始めましょう</p>
            </div>
          </Show>
        </div>
      </Show>

      {/* ===== Editor mode ===== */}
      <Show when={mode() === "edit"}>
      {/* Step indicator */}
      <div class="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 pt-3 pb-4">
        <div class="flex items-center gap-2 mb-3">
          <button class="text-gray-500 touch-target" onClick={() => setMode("list")}>←</button>
          <h1 class="text-lg font-bold flex-1 truncate">{eventName() || "カタログ作成"}</h1>
          <button class="btn-secondary text-xs !px-3" onClick={saveCatalog}>
            {saveStatus() || "保存"}
          </button>
        </div>
        <div class="flex items-center gap-1">
          {STEPS.map((s, i) => (
            <>
              <button
                class="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                classList={{
                  "bg-primary-600 text-white shadow-sm": step() === i,
                  "bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300": step() > i,
                  "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500": step() < i,
                }}
                onClick={() => { if (i <= step() || (i === step() + 1 && canProceed())) setStep(i as Step); }}
              >
                <span class="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border"
                  classList={{ "border-white/30": step() === i, "border-primary-300 dark:border-primary-700": step() > i, "border-gray-300 dark:border-gray-600": step() < i }}
                >{step() > i ? "✓" : s.short}</span>
                <span class="hidden sm:inline">{s.label}</span>
              </button>
              {i < 2 && <div class="flex-1 h-px" classList={{ "bg-primary-300 dark:bg-primary-700": step() > i, "bg-gray-200 dark:bg-gray-700": step() <= i }} />}
            </>
          ))}
        </div>
      </div>

      <div class="flex-1 p-4">
        {/* ===== Step 0: Event info ===== */}
        <Show when={step() === 0}>
          <div class="space-y-4">
            <div class="card space-y-4">
              <p class="text-sm text-gray-500 dark:text-gray-400">カタログの基本情報を入力してください</p>
              <div>
                <label class="block text-sm font-medium mb-1">イベント種別</label>
                <div class="flex gap-2">
                  {(Object.keys(EVENT_PRESETS) as EventType[]).map((type) => (
                    <button
                      type="button"
                      class="flex-1 py-2 rounded-lg text-sm font-medium transition-colors border-2"
                      classList={{
                        "!bg-primary-600 !border-primary-600 !text-white": eventType() === type,
                        "!bg-white !border-gray-300 !text-gray-800 dark:!bg-gray-700 dark:!border-gray-600 dark:!text-gray-200": eventType() !== type,
                      }}
                      onClick={() => changeEventType(type)}
                    >
                      {EVENT_PRESETS[type].label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">イベント名 <span class="text-red-500">*</span></label>
                <input type="text" class="input-field" placeholder={eventType() === "m3" ? "M3-2026春" : "イベント名"} value={eventName()} onInput={(e) => setEventName(e.currentTarget.value)} />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">日付 <span class="text-red-500">*</span></label>
                <input type="date" class="input-field" value={eventDate()} onInput={(e) => setEventDate(e.currentTarget.value)} />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">会場</label>
                <input type="text" class="input-field" placeholder="会場名" value={eventVenue()} onInput={(e) => setEventVenue(e.currentTarget.value)} readOnly={eventType() === "m3"} />
              </div>
              <div>
                <label class="block text-sm font-medium mb-1">発行者名</label>
                <input type="text" class="input-field" placeholder="カタログ作成者の名前" value={publisherName()} onInput={(e) => setPublisherName(e.currentTarget.value)} />
              </div>
              <Show when={eventType() === "m3"}>
                <div class="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-1">
                  <p class="font-medium">M3 スペース形式</p>
                  <p>英字+数字 → 第一展示場（例: A-01）</p>
                  <p>ひらがな+数字 → 第二展示場1F（例: あ-01）</p>
                  <p>カタカナ+数字 → 第二展示場2F（例: ア-01）</p>
                </div>
              </Show>
            </div>
            <div class="card space-y-2">
              <p class="text-sm font-medium">既存データから始める</p>
              <div class="flex gap-2">
                <button class="btn-secondary flex-1 text-sm" onClick={handleJsonImport}>JSON取込</button>
                <button class="btn-secondary flex-1 text-sm" onClick={handleCsvImport}>CSV取込</button>
              </div>
              <p class="text-xs text-gray-400 dark:text-gray-500">既存のカタログJSONやCSVを読み込んで編集を続けられます</p>
            </div>
          </div>
        </Show>

        {/* ===== Step 1: Circle table + item modal ===== */}
        <Show when={step() === 1}>
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <p class="text-sm text-gray-500 dark:text-gray-400">
                サークル <span class="font-bold text-gray-700 dark:text-gray-200">{circles.length}</span> 件
                <Show when={totalItems() > 0}>
                  <span class="ml-2">/ 頒布物 <span class="font-bold text-gray-700 dark:text-gray-200">{totalItems()}</span> 点</span>
                </Show>
              </p>
              <div class="flex gap-1.5">
                <button class="btn-secondary text-xs !px-2 !py-1" onClick={handleJsonImport}>JSON</button>
                <button class="btn-secondary text-xs !px-2 !py-1" onClick={handleCsvImport}>CSV</button>
              </div>
            </div>

            <p class="text-xs text-gray-400 dark:text-gray-500">サークル行をダブルクリックで頒布物を編集</p>

            {/* Table */}
            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
              <div class="overflow-x-auto">
                <table class="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th class={`${th} w-8 text-center cursor-pointer select-none`} onClick={() => toggleSort("index")}>#{ sortIndicator("index")}</th>
                      <th class={`${th} min-w-32 cursor-pointer select-none`} onClick={() => toggleSort("name")}>サークル名{sortIndicator("name")}</th>
                      <th class={`${th} min-w-24`}>代表者</th>
                      <th class={`${th} w-24 cursor-pointer select-none`} onClick={() => toggleSort("space")}>スペース{sortIndicator("space")}</th>
                      <Show when={eventType() === "m3"}>
                        <th class={`${th} w-28 cursor-pointer select-none`} onClick={() => toggleSort("hall")}>ホール{sortIndicator("hall")}</th>
                      </Show>
                      <th class={`${th} w-24 cursor-pointer select-none`} onClick={() => toggleSort("genre")}>ジャンル{sortIndicator("genre")}</th>
                      <th class={`${th} w-28`}>Twitter</th>
                      <th class={`${th} w-16 text-center`}>頒布物</th>
                      <th class={`${th} w-8`}></th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={sortedIndices()}>
                      {(index) => {
                        const circle = circles[index];
                        return (
                        <tr
                          class={`${rowHover} cursor-pointer`}
                          classList={{ "bg-primary-50/40 dark:bg-primary-900/15": modalCircleIndex() === index }}
                          onDblClick={() => setModalCircleIndex(index)}
                        >
                          <td class={`${td} text-center text-xs text-gray-300 dark:text-gray-600 tabular-nums`}>{index + 1}</td>
                          <td class={td}><Cell value={circle.name} onInput={(v) => updateCircle(index, "name", v)} placeholder="サークル名" class="font-medium" /></td>
                          <td class={td}><Cell value={circle.author} onInput={(v) => updateCircle(index, "author", v)} placeholder="-" /></td>
                          <td class={td}>
                            <Cell
                              value={circle.space.raw}
                              onInput={(v) => updateCircle(index, "spaceRaw", v)}
                              placeholder={EVENT_PRESETS[eventType()].spacePlaceholder || "-"}
                              class={`font-mono text-xs ${circle.space.raw && !validateSpace(eventType(), circle.space.raw).valid ? "!text-red-500" : ""}`}
                            />
                          </td>
                          <Show when={eventType() === "m3"}>
                            <td class={`${td} px-2 text-xs text-gray-500`}>
                              {circle.space.raw ? inferM3Hall(circle.space.raw) : "-"}
                            </td>
                          </Show>
                          <td class={td}><Cell value={circle.genre} onInput={(v) => updateCircle(index, "genre", v)} placeholder="-" /></td>
                          <td class={td}><Cell value={circle.urls.twitter} onInput={(v) => updateCircle(index, "twitter", v)} placeholder="@username" class="text-xs" /></td>
                          <td class={`${td} text-center`}>
                            <button
                              class="text-xs tabular-nums px-2 py-0.5 rounded-full transition-colors"
                              classList={{
                                "text-gray-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30": circle.items.length === 0,
                                "text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 font-medium": circle.items.length > 0,
                              }}
                              onClick={() => setModalCircleIndex(index)}
                            >
                              {circle.items.length > 0 ? `${circle.items.length} 点` : "+"}
                            </button>
                          </td>
                          <td class={`${td} text-center`}>
                            <button class="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1" onClick={() => removeCircle(index)}>✕</button>
                          </td>
                        </tr>
                        );
                      }}
                    </For>
                  </tbody>
                </table>
              </div>
              <button
                class="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-400 hover:text-primary-600 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors border-t border-gray-100 dark:border-gray-800"
                onClick={() => setCircles(produce((c) => c.push(emptyCircle())))}
              >
                <span class="text-lg leading-none">+</span>
                <span>新規サークル</span>
              </button>
            </div>
          </div>
        </Show>

        {/* ===== Step 2: Preview & Export ===== */}
        <Show when={step() === 2}>
          <div class="space-y-4">
            <div class="card">
              <h2 class="font-bold mb-3">カタログ概要</h2>
              <dl class="text-sm space-y-2">
                <div class="flex justify-between"><dt class="text-gray-500">イベント</dt><dd class="font-medium">{eventName()}</dd></div>
                <div class="flex justify-between"><dt class="text-gray-500">日付</dt><dd>{eventDate()}</dd></div>
                <Show when={eventVenue()}><div class="flex justify-between"><dt class="text-gray-500">会場</dt><dd>{eventVenue()}</dd></div></Show>
                <Show when={publisherName()}><div class="flex justify-between"><dt class="text-gray-500">発行者</dt><dd>{publisherName()}</dd></div></Show>
                <div class="border-t border-gray-200 dark:border-gray-700 pt-2 flex justify-between"><dt class="text-gray-500">サークル数</dt><dd class="font-bold">{circles.length}</dd></div>
                <div class="flex justify-between"><dt class="text-gray-500">総頒布物数</dt><dd class="font-bold">{totalItems()}</dd></div>
              </dl>
            </div>

            <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
              <div class="px-3 py-2 border-b border-gray-200 dark:border-gray-700"><h2 class="font-bold text-sm">データプレビュー</h2></div>
              <div class="overflow-x-auto max-h-72">
                <table class="w-full text-sm border-collapse">
                  <thead>
                    <tr>
                      <th class={th}>サークル</th>
                      <th class={`${th} w-20`}>スペース</th>
                      <th class={`${th} w-16 text-right`}>点数</th>
                      <th class={`${th} w-24 text-right`}>合計</th>
                    </tr>
                  </thead>
                  <tbody>
                    <For each={circles}>
                      {(c) => (
                        <tr class="hover:bg-gray-50 dark:hover:bg-gray-700/30">
                          <td class={`${td} px-2 py-1.5`}>
                            <div class="font-medium">{c.name}</div>
                            <Show when={c.items.length > 0}>
                              <div class="text-xs text-gray-400 mt-0.5 truncate max-w-48">
                                {c.items.map((i) => i.name).filter(Boolean).join(", ")}
                              </div>
                            </Show>
                          </td>
                          <td class={`${td} px-2 py-1.5 font-mono text-xs text-gray-500`}>{c.space.raw || "-"}</td>
                          <td class={`${td} px-2 py-1.5 text-right tabular-nums`}>{c.items.length}</td>
                          <td class={`${td} px-2 py-1.5 text-right tabular-nums`}>
                            {c.items.length > 0 ? `¥${c.items.reduce((s, i) => s + i.price, 0).toLocaleString()}` : "-"}
                          </td>
                        </tr>
                      )}
                    </For>
                  </tbody>
                </table>
              </div>
            </div>

            <div class="space-y-2">
              <button class="btn-primary w-full py-3 text-base" onClick={async () => { await saveCatalog(); navigate("/catalogs"); }}>
                カタログを保存
              </button>
              <div class="flex gap-2">
                <button class="btn-secondary flex-1 text-sm" onClick={exportJson}>JSONダウンロード</button>
                <button class="btn-secondary flex-1 text-sm" onClick={copyToClipboard}>
                  {copied() ? "コピーしました!" : "コピー"}
                </button>
              </div>
            </div>
          </div>
        </Show>
      </div>

      </Show>
      {/* ===== end editor mode ===== */}

      {/* Bottom navigation */}
      <Show when={mode() === "edit"}>
      <div class="fixed bottom-14 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-4 py-2 z-40">
        <div class="flex gap-3 max-w-2xl mx-auto">
          <Show when={step() > 0}>
            <button class="btn-secondary flex-1" onClick={prev}>戻る</button>
          </Show>
          <Show when={step() < 2}>
            <button class="btn-primary flex-1" onClick={next} disabled={!canProceed()}>
              {step() === 0 ? "サークル登録へ" : "確認へ"}
            </button>
          </Show>
        </div>
      </div>
      </Show>

      {/* ===== Item Modal ===== */}
      <Show when={modalCircleIndex() !== null}>
        {(_) => {
          const ci = () => modalCircleIndex()!;
          const circle = () => circles[ci()];
          if (!circle()) { setModalCircleIndex(null); return null; }

          return (
            <Portal>
              {/* Backdrop */}
              <div
                class="fixed inset-0 z-50 bg-black/40 flex items-end sm:items-center justify-center"
                onClick={(e) => { if (e.target === e.currentTarget) setModalCircleIndex(null); }}
              >
                {/* Modal */}
                <div class="bg-white dark:bg-gray-800 w-full max-w-lg sm:rounded-xl sm:mx-4 rounded-t-xl max-h-[85vh] flex flex-col shadow-2xl animate-slide-up">
                  {/* Header */}
                  <div class="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-700 shrink-0">
                    <div class="min-w-0">
                      <h2 class="font-bold truncate">{circle().name || "(名前なし)"}</h2>
                      <div class="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                        <Show when={circle().space.raw}>
                          <span class="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{circle().space.raw}</span>
                        </Show>
                        <span>頒布物 {circle().items.length} 点</span>
                        <Show when={circle().items.length > 0}>
                          <span>/ ¥{circle().items.reduce((s, i) => s + i.price, 0).toLocaleString()}</span>
                        </Show>
                      </div>
                    </div>
                    <button class="text-gray-400 hover:text-gray-600 p-1 text-lg" onClick={() => setModalCircleIndex(null)}>✕</button>
                  </div>

                  {/* Item table */}
                  <div class="flex-1 overflow-y-auto">
                    <Show when={circle().items.length > 0}>
                      <table class="w-full text-sm border-collapse">
                        <thead>
                          <tr>
                            <th class={`${th} min-w-32`}>品名</th>
                            <th class={`${th} w-20`}>種類</th>
                            <th class={`${th} w-24`}>価格</th>
                            <th class={`${th} w-14 text-center`}>新刊</th>
                            <th class={`${th} w-8`}></th>
                          </tr>
                        </thead>
                        <tbody>
                          <For each={circle().items}>
                            {(item, ii) => (
                              <tr class={rowHover}>
                                <td class={td}><Cell value={item.name} onInput={(v) => updateItem(ci(), ii(), "name", v)} placeholder="品名" /></td>
                                <td class={td}>
                                  <select
                                    class="w-full bg-transparent border-0 outline-none px-2 py-1.5 text-sm focus:bg-primary-50/50 dark:focus:bg-primary-900/20 transition-colors cursor-pointer"
                                    value={item.type}
                                    onChange={(e) => updateItem(ci(), ii(), "type", e.currentTarget.value)}
                                  >
                                    {ITEM_TYPES.map((o) => <option value={o.value}>{o.label}</option>)}
                                  </select>
                                </td>
                                <td class={td}>
                                  <div class="flex items-center">
                                    <span class="text-xs text-gray-300 dark:text-gray-600 pl-2">¥</span>
                                    <Cell value={String(item.price)} onInput={(v) => updateItem(ci(), ii(), "price", Number(v) || 0)} type="number" class="tabular-nums" min="0" step="100" />
                                  </div>
                                </td>
                                <td class={`${td} text-center`}>
                                  <input type="checkbox" class="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer" checked={item.isNew}
                                    onChange={(e) => updateItem(ci(), ii(), "isNew", e.currentTarget.checked)} />
                                </td>
                                <td class={`${td} text-center`}>
                                  <button class="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 transition-all p-1" onClick={() => removeItem(ci(), ii())}>✕</button>
                                </td>
                              </tr>
                            )}
                          </For>
                        </tbody>
                      </table>
                    </Show>

                    <Show when={circle().items.length === 0}>
                      <div class="text-center py-8 text-gray-400 text-sm">
                        <p>まだ頒布物がありません</p>
                      </div>
                    </Show>
                  </div>

                  {/* Footer */}
                  <div class="px-4 py-3 border-t border-gray-200 dark:border-gray-700 shrink-0 flex gap-2">
                    <button
                      class="btn-primary flex-1 text-sm"
                      onClick={() => addItem(ci())}
                    >
                      + 頒布物を追加
                    </button>
                    <button
                      class="btn-secondary text-sm"
                      onClick={() => setModalCircleIndex(null)}
                    >
                      閉じる
                    </button>
                  </div>
                </div>
              </div>
            </Portal>
          );
        }}
      </Show>
    </div>
  );
}
