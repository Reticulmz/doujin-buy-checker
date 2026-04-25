import { type ParentComponent, type JSX } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { ClipboardList, BookOpen, RefreshCw, Settings } from "~/components/icons";
import { InstallBanner } from "./InstallBanner";
import { OfflineBadge } from "./OfflineBadge";

export const AppShell: ParentComponent = (props) => {
  const location = useLocation();

  const navItems: { href: string; icon: (p: { size: number }) => JSX.Element; label: string }[] = [
    { href: "/", icon: (p) => <ClipboardList size={p.size} />, label: "イベント" },
    { href: "/catalogs", icon: (p) => <BookOpen size={p.size} />, label: "カタログ" },
    { href: "/transfer", icon: (p) => <RefreshCw size={p.size} />, label: "転送" },
    { href: "/settings", icon: (p) => <Settings size={p.size} />, label: "設定" },
  ];

  return (
    <div class="min-h-dvh flex flex-col">
      <InstallBanner />
      <OfflineBadge />
      <main class="flex-1 pb-18">{props.children}</main>
      <nav class="fixed bottom-0 left-0 right-0 glass z-50">
        <div class="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
          {navItems.map((item) => {
            const isActive = () =>
              item.href === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.href);
            return (
              <A
                href={item.href}
                class="relative flex flex-col items-center justify-center gap-0.5 w-16 h-14 rounded-xl text-xs transition-all active:scale-95"
                classList={{
                  "text-primary-600 dark:text-primary-400 font-bold bg-primary-50 dark:bg-primary-900/30": isActive(),
                  "text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300": !isActive(),
                }}
              >
                {item.icon({ size: 20 })}
                <span class="mt-0.5">{item.label}</span>
              </A>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
