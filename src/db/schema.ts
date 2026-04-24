import Dexie, { type EntityTable } from "dexie";

export type EventType = "m3" | "custom";

export interface Event {
  id: string;
  name: string;
  date: string;
  venue: string;
  budget: number;
  eventType: EventType;
  createdAt: string;
  updatedAt: string;
}

export interface CatalogSubscription {
  id: string;
  url: string;
  name: string;
  lastFetchedAt: string | null;
  lastHash: string | null;
  status: "ok" | "error" | "fetching";
  errorMessage: string | null;
  createdAt: string;
}

export interface Circle {
  id: string;
  eventId: string;
  catalogSourceId: string | null;
  externalId: string | null;
  name: string;
  author: string;
  spaceNumber: string;
  hall: string;
  genre: string;
  url: string;
  twitterUrl: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

export interface BuyListItem {
  id: string;
  eventId: string;
  circleId: string;
  itemName: string;
  price: number;
  quantity: number;
  priority: 1 | 2 | 3;
  purchased: boolean;
  purchasedAt: string | null;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface StoredCatalog {
  id: string;
  name: string;
  eventName: string;
  eventDate: string;
  eventVenue: string;
  eventType: EventType;
  circleCount: number;
  data: string; // Catalog JSON
  isDraft: boolean;
  sourceUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export const db = new Dexie("DoujinBuyChecker") as Dexie & {
  events: EntityTable<Event, "id">;
  catalogSubscriptions: EntityTable<CatalogSubscription, "id">;
  circles: EntityTable<Circle, "id">;
  buyListItems: EntityTable<BuyListItem, "id">;
  storedCatalogs: EntityTable<StoredCatalog, "id">;
};

db.version(1).stores({
  events: "id, date",
  catalogSubscriptions: "id, url",
  circles: "id, eventId, [eventId+spaceNumber], externalId",
  buyListItems: "id, eventId, circleId, [eventId+priority], [eventId+purchased]",
});

db.version(2).stores({
  events: "id, date",
  catalogSubscriptions: "id, url",
  circles: "id, eventId, [eventId+spaceNumber], externalId",
  buyListItems: "id, eventId, circleId, [eventId+priority], [eventId+purchased]",
}).upgrade((tx) => {
  return tx.table("circles").toCollection().modify((circle) => {
    if (circle.twitterUrl === undefined) circle.twitterUrl = "";
  });
});

db.version(3).stores({
  events: "id, date",
  catalogSubscriptions: "id, url",
  circles: "id, eventId, [eventId+spaceNumber], externalId",
  buyListItems: "id, eventId, circleId, [eventId+priority], [eventId+purchased]",
}).upgrade((tx) => {
  return tx.table("events").toCollection().modify((event) => {
    if (event.eventType === undefined) event.eventType = "custom";
  });
});

db.version(4).stores({
  events: "id, date",
  catalogSubscriptions: "id, url",
  circles: "id, eventId, [eventId+spaceNumber], externalId",
  buyListItems: "id, eventId, circleId, [eventId+priority], [eventId+purchased]",
  catalogDrafts: "id, updatedAt",
});

db.version(5).stores({
  events: "id, date",
  catalogSubscriptions: "id, url",
  circles: "id, eventId, [eventId+spaceNumber], externalId",
  buyListItems: "id, eventId, circleId, [eventId+priority], [eventId+purchased]",
  catalogDrafts: "id, updatedAt",
  storedCatalogs: "id, eventDate, updatedAt",
});

db.version(6).stores({
  events: "id, date",
  catalogSubscriptions: "id, url",
  circles: "id, eventId, [eventId+spaceNumber], externalId",
  buyListItems: "id, eventId, circleId, [eventId+priority], [eventId+purchased]",
  catalogDrafts: null, // drop table
  storedCatalogs: "id, eventDate, updatedAt",
}).upgrade(async (tx) => {
  // Migrate drafts to storedCatalogs
  const drafts = await tx.table("catalogDrafts").toArray();
  for (const draft of drafts) {
    let eventName = "";
    let eventDate = "";
    let eventVenue = "";
    let circleCount = 0;
    try {
      const parsed = JSON.parse(draft.data);
      eventName = parsed.eventName ?? parsed.event?.name ?? "";
      eventDate = parsed.eventDate ?? parsed.event?.date ?? "";
      eventVenue = parsed.eventVenue ?? parsed.event?.venue ?? "";
      circleCount = parsed.circles?.length ?? 0;
    } catch {}
    await tx.table("storedCatalogs").add({
      id: draft.id,
      name: draft.name,
      eventName,
      eventDate,
      eventVenue,
      eventType: draft.eventType ?? "custom",
      circleCount,
      data: draft.data,
      isDraft: true,
      sourceUrl: null,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
    });
  }
});
