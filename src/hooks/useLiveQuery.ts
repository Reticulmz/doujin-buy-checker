import { createSignal, onCleanup } from "solid-js";
import { liveQuery } from "dexie";

export function useLiveQuery<T>(querier: () => T | Promise<T>) {
  const [value, setValue] = createSignal<T | undefined>(undefined);

  const observable = liveQuery(querier);
  const subscription = observable.subscribe({
    next: (val) => setValue(() => val as T),
    error: (err) => console.error("LiveQuery error:", err),
  });

  onCleanup(() => subscription.unsubscribe());

  return value;
}
