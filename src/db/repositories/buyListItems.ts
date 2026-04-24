import { db, type BuyListItem } from "../schema";
import { ulid } from "ulidx";

export async function getItemsByEvent(eventId: string): Promise<BuyListItem[]> {
  return db.buyListItems.where("eventId").equals(eventId).toArray();
}

export async function getItemsByCircle(circleId: string): Promise<BuyListItem[]> {
  return db.buyListItems.where("circleId").equals(circleId).toArray();
}

export async function createItem(
  data: Pick<BuyListItem, "eventId" | "circleId" | "itemName" | "price" | "quantity" | "priority" | "note">
): Promise<BuyListItem> {
  const now = new Date().toISOString();
  const item: BuyListItem = {
    id: ulid(),
    ...data,
    purchased: false,
    purchasedAt: null,
    createdAt: now,
    updatedAt: now,
  };
  await db.buyListItems.add(item);
  return item;
}

export async function updateItem(
  id: string,
  data: Partial<Pick<BuyListItem, "itemName" | "price" | "quantity" | "priority" | "note">>
): Promise<void> {
  await db.buyListItems.update(id, { ...data, updatedAt: new Date().toISOString() });
}

export async function togglePurchased(id: string, purchased: boolean): Promise<void> {
  await db.buyListItems.update(id, {
    purchased,
    purchasedAt: purchased ? new Date().toISOString() : null,
    updatedAt: new Date().toISOString(),
  });
}

export async function deleteItem(id: string): Promise<void> {
  await db.buyListItems.delete(id);
}
