import { type ParentComponent } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { InstallBanner } from "./InstallBanner";

export const AppShell: ParentComponent = (props) => {
  const location = useLocation();

  const navItems = [
    { href: "/", icon: "📋", label: "イベント" },
    { href: "/catalogs", icon: "📚", label: "カタログ" },
    { href: "/transfer", icon: "🔄", label: "転送" },
    { href: "/settings", icon: "⚙️", label: "設定" },
  ];

  return (
    <div class="min-h-screen flex flex-col">
      <InstallBanner />
      <main class="flex-1 pb-16">{props.children}</main>
      <nav class="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 z-50">
        <div class="flex justify-around items-center h-14 max-w-lg mx-auto">
          {navItems.map((item) => {
            const isActive = () =>
              item.href === "/"
                ? location.pathname === "/"
                : location.pathname.startsWith(item.href);
            return (
              <A
                href={item.href}
                class="flex flex-col items-center justify-center gap-0.5 touch-target text-xs transition-colors"
                classList={{
                  "text-primary-600 dark:text-primary-400 font-bold": isActive(),
                  "text-gray-500 dark:text-gray-400": !isActive(),
                }}
              >
                <span class="text-lg">{item.icon}</span>
                <span>{item.label}</span>
              </A>
            );
          })}
        </div>
      </nav>
    </div>
  );
};
