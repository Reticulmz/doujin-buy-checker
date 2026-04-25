import { db, type Circle } from "../schema";
import { ulid } from "ulidx";

export async function getCirclesByEvent(eventId: string): Promise<Circle[]> {
  return db.circles.where("eventId").equals(eventId).toArray();
}

export async function getCircle(id: string): Promise<Circle | undefined> {
  return db.circles.get(id);
}

export async function createCircle(
  data: Pick<Circle, "eventId" | "name" | "author" | "spaceNumber" | "hall" | "genre" | "websiteUrl" | "twitterUrl" | "description"> &
    Partial<Pick<Circle, "catalogSourceId" | "externalId" | "visited">>
): Promise<Circle> {
  const now = new Date().toISOString();
  const circle: Circle = {
    id: ulid(),
    catalogSourceId: null,
    externalId: null,
    visited: false,
    ...data,
    createdAt: now,
    updatedAt: now,
  };
  await db.circles.add(circle);
  return circle;
}

export async function updateCircle(
  id: string,
  data: Partial<Pick<Circle, "name" | "author" | "spaceNumber" | "hall" | "genre" | "websiteUrl" | "twitterUrl" | "description">>
): Promise<void> {
  await db.circles.update(id, { ...data, updatedAt: new Date().toISOString() });
}

export async function toggleVisited(id: string, visited: boolean): Promise<void> {
  await db.circles.update(id, { visited, updatedAt: new Date().toISOString() });
}

export async function deleteCircle(id: string): Promise<void> {
  await db.transaction("rw", [db.circles, db.buyListItems], async () => {
    await db.buyListItems.where("circleId").equals(id).delete();
    await db.circles.delete(id);
  });
}
