import { createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { useLiveQuery } from "~/hooks/useLiveQuery";
import { db, type EventType } from "~/db/schema";
import { createEvent, deleteEvent } from "~/db/repositories/events";
import { EVENT_PRESETS } from "~/services/eventPresets";

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
    if (confirm(`「${eventName}」を削除しますか？関連するサークルと購入リストも削除されます。`)) {
      await deleteEvent(id);
    }
  };

  return (
    <div class="p-4 max-w-lg mx-auto">
      <h1 class="text-xl font-bold mb-4">購入リスト</h1>

      {/* Empty state - catalog first */}
      <Show when={events() && events()!.length === 0}>
        <div class="space-y-4 py-4">
          <div class="text-center text-gray-500 dark:text-gray-400">
            <div class="text-4xl mb-3">📋</div>
            <p class="font-medium text-gray-700 dark:text-gray-200">まだ購入リストがありません</p>
            <p class="text-sm mt-1">カタログを取り込んで、欲しい頒布物をピックアップしましょう</p>
          </div>

          <A href="/catalogs" class="btn-primary w-full block text-center py-3">
            カタログから作成
          </A>

          <button
            class="text-sm text-gray-500 dark:text-gray-400 w-full text-center hover:text-primary-600 transition-colors"
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
                        <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-medium uppercase">
                          {event.eventType}
                        </span>
                      </Show>
                    </div>
                    <div class="text-sm text-gray-500 dark:text-gray-400 mt-1 space-y-0.5">
                      <div>📅 {event.date}</div>
                      <Show when={event.venue}>
                        <div>📍 {event.venue}</div>
                      </Show>
                      <Show when={event.budget > 0}>
                        <div>💰 ¥{event.budget.toLocaleString()}</div>
                      </Show>
                    </div>
                  </A>
                  <button
                    class="text-gray-400 hover:text-red-500 p-2 touch-target"
                    onClick={() => handleDelete(event.id, event.name)}
                    title="削除"
                  >
                    🗑
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
            <button type="button" class="text-gray-400 text-sm" onClick={() => setShowManual(false)}>✕</button>
          </div>

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
