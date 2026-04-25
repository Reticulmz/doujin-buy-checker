import { db, type Circle } from "~/db/schema";
import { ulid } from "ulidx";

interface CatalogJson {
  schemaVersion: string;
  catalog: { id: string; name: string };
  event: { name: string; date: string; venue?: string };
  circles: {
    id: string;
    name: string;
    author?: string;
    space?: { block?: string; hall?: string; number?: number; sub?: string; raw?: string };
    genre?: string;
    description?: string;
    urls?: { website?: string; twitter?: string; pixiv?: string };
    items?: { name: string; price: number; type?: string; isNew?: boolean }[];
    tags?: string[];
  }[];
}

export interface ImportResult {
  catalogName: string;
  eventName: string;
  eventDate: string;
  eventVenue: string;
  totalCircles: number;
  newCircles: number;
  updatedCircles: number;
}

export function parseCatalogJson(text: string): CatalogJson {
  const data = JSON.parse(text);
  if (!data.schemaVersion || !data.circles || !Array.isArray(data.circles)) {
    throw new Error("カタログJSON形式が不正です（schemaVersion, circlesが必要）");
  }
  return data as CatalogJson;
}

export async function importCatalogToEvent(
  catalog: CatalogJson,
  eventId: string,
  catalogSourceId: string,
): Promise<ImportResult> {
  const now = new Date().toISOString();
  let newCircles = 0;
  let updatedCircles = 0;

  await db.transaction("rw", [db.circles], async () => {
    for (const c of catalog.circles) {
      const existing = await db.circles
        .where("externalId")
        .equals(c.id)
        .and((circle) => circle.eventId === eventId)
        .first();

      const spaceRaw = c.space?.raw ?? "";
      const circleData = {
        name: c.name,
        author: c.author ?? "",
        spaceNumber: spaceRaw,
        hall: c.space?.hall ?? "",
        genre: c.genre ?? "",
        websiteUrl: c.urls?.website ?? "",
        twitterUrl: c.urls?.twitter ?? "",
        description: c.description ?? "",
        updatedAt: now,
      };

      if (existing) {
        await db.circles.update(existing.id, circleData);
        updatedCircles++;
      } else {
        const circle: Circle = {
          id: ulid(),
          eventId,
          catalogSourceId,
          externalId: c.id,
          ...circleData,
          createdAt: now,
        };
        await db.circles.add(circle);
        newCircles++;
      }
    }
  });

  return {
    catalogName: catalog.catalog.name,
    eventName: catalog.event.name,
    eventDate: catalog.event.date,
    eventVenue: catalog.event.venue ?? "",
    totalCircles: catalog.circles.length,
    newCircles,
    updatedCircles,
  };
}
