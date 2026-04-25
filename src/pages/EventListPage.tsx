import { createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { useLiveQuery } from "~/hooks/useLiveQuery";
import { db, type EventType } from "~/db/schema";
import { createEvent, deleteEvent } from "~/db/repositories/events";
import { EVENT_PRESETS } from "~/services/eventPresets";
import { ClipboardList, Calendar, MapPin, Wallet, Trash2, X } from "~/components/icons";
import { confirm } from "~/components/ConfirmDialog";
import { showToast } from "~/components/Toast";

export default function EventListPage() {
  const events = useLiveQuery(() => db.events.orderBy("date").reverse().toArray());
  const [showManual, setShowManual] = createSignal(false);
  const [eventType, setEventType] = createSignal<EventType>("m3");
  const [name, setName] = createSignal("");
  const [date, setDate] = createSignal("");
  const [venue, setVenue] = createSignal("");
  const [budget, setBudget] = createSignal(0);

  const changeEventType = (type: EventType) => {
    setEventType(type);
    const preset = EVENT_PRESETS[type];
    if (preset.venue) setVenue(preset.venue);
  };

  const handleSubmit = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!name().trim() || !date()) return;
    await createEvent({
      name: name().trim(),
      date: date(),
      venue: venue().trim(),
      budget: budget(),
      eventType: eventType(),
    });
    setName("");
    setDate("");
    setVenue("");
    setBudget(0);
    setEventType("m3");
    setShowManual(false);
  };

  const handleDelete = async (id: string, eventName: string) => {
    const ok = await confirm({
      title: "イベントを削除",
      description: `「${eventName}」を削除しますか？関連するサークルと購入リストも削除されます。`,
      confirmLabel: "削除",
      variant: "danger",
    });
    if (ok) {
      await deleteEvent(id);
      showToast("イベントを削除しました");
    }
  };

  return (
    <div class="p-4 max-w-lg mx-auto">
      <h1 class="text-xl font-bold mb-4">購入リスト</h1>

      {/* Empty state - catalog first */}
      <Show when={events() && events()!.length === 0}>
        <div class="space-y-6 py-8">
          <div class="text-center">
            <div class="w-20 h-20 rounded-3xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mx-auto mb-4">
              <ClipboardList size={36} class="text-primary-400" />
            </div>
            <h2 class="font-bold text-lg text-gray-800 dark:text-gray-100">購入リストを始めよう</h2>
            <p class="text-sm text-gray-500 dark:text-gray-400 mt-2 leading-relaxed max-w-xs mx-auto">
              カタログを取り込んで、イベントで欲しい<br />頒布物をピックアップしましょう
            </p>
          </div>

          <A href="/catalogs" class="btn-primary w-full block text-center py-3.5 text-base">
            カタログから作成
          </A>

          <button
            class="text-sm text-gray-400 dark:text-gray-500 w-full text-center hover:text-primary-600 transition-colors"
            onClick={() => setShowManual(true)}
          >
            カタログなしで手動作成 →
          </button>
        </div>
      </Show>

      {/* Has events */}
      <Show when={events() && events()!.length > 0}>
        {/* Add new */}
        <div class="flex gap-2 mb-4">
          <A href="/catalogs" class="btn-primary flex-1 text-center text-sm">
            カタログから追加
          </A>
          <button
            class="btn-secondary text-sm"
            onClick={() => setShowManual(!showManual())}
          >
            {showManual() ? "閉じる" : "手動追加"}
          </button>
        </div>

        {/* Event list */}
        <div class="space-y-3">
          <For each={events()}>
            {(event) => (
              <div class="card">
                <div class="flex items-start justify-between">
                  <A href={`/event/${event.id}`} class="flex-1 min-w-0">
                    <div class="flex items-center gap-2">
                      <h2 class="font-bold text-lg truncate">{event.name}</h2>
                      <Show when={event.eventType && event.eventType !== "custom"}>
                        <span class="text-xs px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-medium uppercase">
                          {event.eventType}
                        </span>
                      </Show>
                    </div>
                    <div class="text-sm text-gray-500 dark:text-gray-400 mt-1 space-y-0.5">
                      <div class="flex items-center gap-1.5"><Calendar size={14} /> {event.date}</div>
                      <Show when={event.venue}>
                        <div class="flex items-center gap-1.5"><MapPin size={14} /> {event.venue}</div>
                      </Show>
                      <Show when={event.budget > 0}>
                        <div class="flex items-center gap-1.5"><Wallet size={14} /> ¥{event.budget.toLocaleString()}</div>
                      </Show>
                    </div>
                  </A>
                  <button
                    class="text-gray-500 hover:text-red-500 p-2 touch-target"
                    onClick={() => handleDelete(event.id, event.name)}
                    title="削除"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Manual creation form (collapsed by default) */}
      <Show when={showManual()}>
        <form onSubmit={handleSubmit} class="card mt-4 space-y-3">
          <div class="flex items-center justify-between">
            <h2 class="font-bold text-sm">手動でイベントを作成</h2>
            <button type="button" class="text-gray-500 p-1 touch-target" onClick={() => setShowManual(false)}><X size={18} /></button>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">イベント種別</label>
            <div class="flex gap-2 p-1 rounded-2xl bg-gray-100 dark:bg-gray-800">
              {(Object.keys(EVENT_PRESETS) as EventType[]).map((type) => (
                <button
                  type="button"
                  class="flex-1 py-2 rounded-xl text-sm font-semibold transition-all"
                  classList={{
                    "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm": eventType() === type,
                    "text-gray-500 dark:text-gray-400": eventType() !== type,
                  }}
                  onClick={() => changeEventType(type)}
                >
                  {EVENT_PRESETS[type].label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">イベント名 *</label>
            <input type="text" class="input-field" value={name()} onInput={(e) => setName(e.currentTarget.value)} placeholder={eventType() === "m3" ? "M3-2026春" : "イベント名"} required />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">日付 *</label>
            <input type="date" class="input-field" value={date()} onInput={(e) => setDate(e.currentTarget.value)} required />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">会場</label>
            <input type="text" class="input-field" value={venue()} onInput={(e) => setVenue(e.currentTarget.value)} placeholder="会場名" readOnly={eventType() === "m3"} />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">予算（円）</label>
            <input type="number" class="input-field" value={budget()} onInput={(e) => setBudget(Number(e.currentTarget.value))} min="0" step="100" />
          </div>
          <button type="submit" class="btn-primary w-full">作成</button>
        </form>
      </Show>
    </div>
  );
}
