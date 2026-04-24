import { createSignal, createEffect, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { useLiveQuery } from "~/hooks/useLiveQuery";
import { db, type EventType } from "~/db/schema";
import { createEvent, deleteEvent } from "~/db/repositories/events";
import { EVENT_PRESETS } from "~/services/eventPresets";

export default function EventListPage() {
  const events = useLiveQuery(() => db.events.orderBy("date").reverse().toArray());
  const [showForm, setShowForm] = createSignal(false);
  const [eventType, setEventType] = createSignal<EventType>("m3");
  const [name, setName] = createSignal("");
  const [date, setDate] = createSignal("");
  const [venue, setVenue] = createSignal("");
  const [budget, setBudget] = createSignal(0);

  // プリセット変更時に会場を自動入力
  createEffect(() => {
    const preset = EVENT_PRESETS[eventType()];
    if (preset.venue) {
      setVenue(preset.venue);
    }
  });

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
    setShowForm(false);
  };

  const handleDelete = async (id: string, eventName: string) => {
    if (confirm(`「${eventName}」を削除しますか？関連するサークルと購入リストも削除されます。`)) {
      await deleteEvent(id);
    }
  };

  return (
    <div class="p-4 max-w-lg mx-auto">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-xl font-bold">イベント一覧</h1>
        <button class="btn-primary text-sm" onClick={() => setShowForm(!showForm())}>
          {showForm() ? "キャンセル" : "+ 追加"}
        </button>
      </div>

      <Show when={showForm()}>
        <form onSubmit={handleSubmit} class="card mb-4 space-y-3">
          {/* Preset selector */}
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
                  onClick={() => setEventType(type)}
                >
                  {EVENT_PRESETS[type].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium mb-1">イベント名 *</label>
            <input
              type="text"
              class="input-field"
              value={name()}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder={eventType() === "m3" ? "M3-2026春" : "イベント名"}
              required
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">日付 *</label>
            <input
              type="date"
              class="input-field"
              value={date()}
              onInput={(e) => setDate(e.currentTarget.value)}
              required
            />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">会場</label>
            <input
              type="text"
              class="input-field"
              value={venue()}
              onInput={(e) => setVenue(e.currentTarget.value)}
              placeholder="会場名"
              readOnly={eventType() === "m3"}
            />
            <Show when={eventType() === "m3"}>
              <p class="text-xs text-gray-400 mt-1">M3プリセット: 東京流通センター</p>
            </Show>
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">予算（円）</label>
            <input
              type="number"
              class="input-field"
              value={budget()}
              onInput={(e) => setBudget(Number(e.currentTarget.value))}
              min="0"
              step="100"
            />
          </div>

          <Show when={eventType() === "m3"}>
            <div class="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3 space-y-1">
              <p class="font-medium">M3 スペース形式</p>
              <p>英字+数字 → 第一展示場（例: A-01）</p>
              <p>ひらがな+数字 → 第二展示場1F（例: あ-01）</p>
              <p>カタカナ+数字 → 第二展示場2F（例: ア-01）</p>
            </div>
          </Show>

          <button type="submit" class="btn-primary w-full">
            作成
          </button>
        </form>
      </Show>

      <Show when={events() && events()!.length === 0}>
        <div class="text-center text-gray-500 dark:text-gray-400 py-12">
          <div class="text-4xl mb-2">📋</div>
          <p>イベントがありません</p>
          <p class="text-sm">「+ 追加」からイベントを作成しましょう</p>
        </div>
      </Show>

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
    </div>
  );
}
