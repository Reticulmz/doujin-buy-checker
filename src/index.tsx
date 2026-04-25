import "virtual:uno.css";
import "@unocss/reset/tailwind.css";
import { registerSW } from "virtual:pwa-register";
import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import { lazy } from "solid-js";
import { AppShell } from "./components/AppShell";
import { ToastRegion } from "./components/Toast";
import { ConfirmDialog } from "./components/ConfirmDialog";

registerSW({ immediate: true });

const EventListPage = lazy(() => import("./pages/EventListPage"));
const BuyListPage = lazy(() => import("./pages/BuyListPage"));
const CircleDetailPage = lazy(() => import("./pages/CircleDetailPage"));
const BudgetSummaryPage = lazy(() => import("./pages/BudgetSummaryPage"));
const CatalogManagePage = lazy(() => import("./pages/CatalogManagePage"));
const TransferPage = lazy(() => import("./pages/TransferPage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const CatalogEditorPage = lazy(() => import("./pages/CatalogEditorPage"));
const CatalogBrowserPage = lazy(() => import("./pages/CatalogBrowserPage"));

// Enable browser scroll restoration
if ("scrollRestoration" in history) {
  history.scrollRestoration = "auto";
}

// Apply saved theme on load
const savedTheme = localStorage.getItem("theme");
if (
  savedTheme === "dark" ||
  (!savedTheme && window.matchMedia("(prefers-color-scheme: dark)").matches)
) {
  document.documentElement.classList.add("dark");
}

render(
  () => (
    <>
    <ToastRegion />
    <ConfirmDialog />
    <Router root={AppShell}>
      <Route path="/" component={EventListPage} />
      <Route path="/event/:eventId" component={BuyListPage} />
      <Route path="/event/:eventId/circle/:circleId" component={CircleDetailPage} />
      <Route path="/event/:eventId/budget" component={BudgetSummaryPage} />
      <Route path="/catalogs" component={CatalogManagePage} />
      <Route path="/transfer" component={TransferPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/catalog-editor" component={CatalogEditorPage} />
      <Route path="/catalog-browse" component={CatalogBrowserPage} />
    </Router>
    </>
  ),
  document.getElementById("app")!
);
