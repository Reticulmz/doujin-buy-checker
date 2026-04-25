import { Toast as KToast, toaster } from "@kobalte/core/toast";
import { Portal } from "solid-js/web";
import { X } from "~/components/icons";

export function showToast(message: string, variant: "success" | "error" = "success") {
  toaster.show((props) => (
    <KToast
      toastId={props.toastId}
      class={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border animate-slide-up ${
        variant === "success"
          ? "bg-white dark:bg-gray-800 border-success/30 text-gray-900 dark:text-gray-100"
          : "bg-white dark:bg-gray-800 border-danger/30 text-gray-900 dark:text-gray-100"
      }`}
    >
      <span class={`w-2 h-2 rounded-full shrink-0 ${variant === "success" ? "bg-success" : "bg-danger"}`} />
      <KToast.Description class="flex-1 text-sm">{message}</KToast.Description>
      <KToast.CloseButton class="text-gray-400 hover:text-gray-600 p-1 shrink-0" aria-label="閉じる">
        <X size={14} />
      </KToast.CloseButton>
    </KToast>
  ));
}

export function ToastRegion() {
  return (
    <Portal>
      <KToast.Region duration={3000}>
        <KToast.List class="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[calc(100%-2rem)] max-w-sm" />
      </KToast.Region>
    </Portal>
  );
}
