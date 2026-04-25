import { createSignal, Show } from "solid-js";
import { AlertDialog } from "@kobalte/core/alert-dialog";
import { Portal } from "solid-js/web";

interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
}

type ConfirmResolver = (result: boolean) => void;

const [open, setOpen] = createSignal(false);
const [options, setOptions] = createSignal<ConfirmOptions>({ title: "", description: "" });
let resolver: ConfirmResolver | null = null;

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    resolver = resolve;
    setOptions(opts);
    setOpen(true);
  });
}

export function ConfirmDialog() {
  const handleResult = (result: boolean) => {
    setOpen(false);
    resolver?.(result);
    resolver = null;
  };

  return (
    <AlertDialog open={open()} onOpenChange={(isOpen) => { if (!isOpen) handleResult(false); }}>
      <Show when={open()}>
        <Portal>
          <AlertDialog.Overlay class="fixed inset-0 bg-black/40 z-[90]" />
          <div class="fixed inset-0 z-[91] flex items-center justify-center p-4">
            <AlertDialog.Content class="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 w-full max-w-sm p-5 space-y-4">
              <AlertDialog.Title class="text-lg font-bold">
                {options().title}
              </AlertDialog.Title>
              <AlertDialog.Description class="text-sm text-gray-600 dark:text-gray-400">
                {options().description}
              </AlertDialog.Description>
              <div class="flex gap-2 justify-end">
                <button
                  class="btn-secondary text-sm"
                  onClick={() => handleResult(false)}
                >
                  {options().cancelLabel ?? "キャンセル"}
                </button>
                <button
                  class={options().variant === "danger" ? "btn-danger text-sm" : "btn-primary text-sm"}
                  onClick={() => handleResult(true)}
                >
                  {options().confirmLabel ?? "OK"}
                </button>
              </div>
            </AlertDialog.Content>
          </div>
        </Portal>
      </Show>
    </AlertDialog>
  );
}
