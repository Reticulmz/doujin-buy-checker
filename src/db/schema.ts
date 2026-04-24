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

export const db = new Dexie("DoujinBuyChecker") as Dexie & {
  events: EntityTable<Event, "id">;
  catalogSubscriptions: EntityTable<CatalogSubscription, "id">;
  circles: EntityTable<Circle, "id">;
  buyListItems: EntityTable<BuyListItem, "id">;
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
