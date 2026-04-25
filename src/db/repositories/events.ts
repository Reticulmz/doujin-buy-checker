import { db, type Event } from "../schema";
import { ulid } from "ulidx";

export async function getAllEvents(): Promise<Event[]> {
  return db.events.orderBy("date").reverse().toArray();
}

export async function getEvent(id: string): Promise<Event | undefined> {
  return db.events.get(id);
}

export async function createEvent(
  data: Pick<Event, "name" | "date" | "venue" | "budget" | "eventType"> & Partial<Pick<Event, "sourceCatalogId">>
): Promise<Event> {
  const now = new Date().toISOString();
  const event: Event = {
    id: ulid(),
    sourceCatalogId: null,
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  await db.events.add(event);
  return event;
}

export async function updateEvent(
  id: string,
  data: Partial<Pick<Event, "name" | "date" | "venue" | "budget">>
): Promise<void> {
  await db.events.update(id, { ...data, updatedAt: new Date().toISOString() });
}

export async function deleteEvent(id: string): Promise<void> {
  await db.transaction("rw", [db.events, db.circles, db.buyListItems], async () => {
    await db.buyListItems.where("eventId").equals(id).delete();
    await db.circles.where("eventId").equals(id).delete();
    await db.events.delete(id);
  });
}
