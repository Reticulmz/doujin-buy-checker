/**
 * M3 サークルリストページ（m3net.jp）のHTMLをパースし、
 * カタログJSON形式に変換するスクレイパー。
 *
 * HTML構造:
 *   <details><summary>[A]</summary>
 *     <dl class="d_box">
 *       <div>
 *         <dt class="d_ttl"><span>A-01a</span><span><a href="URL">名前<!--フリガナ--></a></span></dt>
 *         <dd>説明文</dd>
 *       </div>
 *       <!-- M01\tタグ1\tフリガナ\t...\tURL1\tURL2\t... -->
 *     </dl>
 *   </details>
 */

interface M3Circle {
  id: string;
  name: string;
  kana: string;
  space: { block: string; hall: string; number: number; sub: string; raw: string };
  genre: string;
  description: string;
  urls: { website: string; twitter: string };
  tags: string[];
}

export interface M3ScrapeResult {
  circles: M3Circle[];
  sectionCount: number;
}

function parseSpaceNumber(raw: string): M3Circle["space"] {
  const trimmed = raw.trim();
  const match = trimmed.match(/^([A-Za-zぁ-んァ-ヶ])-?(\d+)([a-z]*)$/);
  if (!match) return { block: "", hall: "", number: 0, sub: "", raw: trimmed };
  return {
    block: match[1],
    hall: "",
    number: parseInt(match[2], 10),
    sub: match[3],
    raw: trimmed,
  };
}

function parseCommentMeta(comment: string): { hallCode: string; tags: string[]; twitterUrl: string } {
  const parts = comment.split("\t").map((s) => s.trim());
  const hallCode = parts[0] ?? "";

  // Tags are pairs: keyword, kana (3 pairs starting at index 1)
  const tags: string[] = [];
  for (let i = 1; i < 7 && i < parts.length; i += 2) {
    if (parts[i]) tags.push(parts[i]);
  }

  // URLs start at index 7+
  let twitterUrl = "";
  for (let i = 7; i < parts.length; i++) {
    const urlPart = parts[i].split("<>")[0].trim();
    if (urlPart && (urlPart.includes("twitter.com") || urlPart.includes("x.com"))) {
      if (!twitterUrl) twitterUrl = urlPart;
    }
  }

  return { hallCode, tags, twitterUrl };
}

export function parseM3Html(html: string): M3ScrapeResult {
  // Use regex-based parsing for reliability (DOMParser may mangle dl>div structure)
  const circles: M3Circle[] = [];
  let sectionCount = 0;

  // Count sections
  const sectionMatches = html.matchAll(/<summary[^>]*>/g);
  for (const _ of sectionMatches) sectionCount++;

  // Match circle entries: <div><dt>...<dd>...</dd></div> followed by <!-- comment -->
  const entryPattern = /<div><dt class="d_ttl"><span>\s*(.+?)\s*<\/span><span>(?:<a href="([^"]*)"[^>]*>)?\s*(.*?)\s*(?:<\/a>)?<\/span><\/dt><dd>\s*([\s\S]*?)\s*<\/dd><\/div>\s*<!--\s*([\s\S]*?)\s*-->/g;

  for (const match of html.matchAll(entryPattern)) {
    const spaceRaw = match[1].trim();
    const websiteUrl = match[2] ?? "";
    const nameHtml = match[3];
    const description = match[4].trim();
    const commentText = match[5].trim();

    // Extract name and kana from nameHtml (may contain <!-- kana -->)
    let name = "";
    let kana = "";
    const kanaMatch = nameHtml.match(/<!--\s*(.+?)\s*-->/);
    if (kanaMatch) {
      kana = kanaMatch[1].trim();
      name = nameHtml.replace(/<!--[\s\S]*?-->/, "").trim();
    } else {
      name = nameHtml.trim();
    }

    // Parse comment metadata
    const meta = commentText.startsWith("M") ? parseCommentMeta(commentText) : { hallCode: "", tags: [] as string[], twitterUrl: "" };

    // Separate twitter from website
    let twitter = meta.twitterUrl;
    let website = websiteUrl;
    if (website && (website.includes("twitter.com") || website.includes("x.com"))) {
      if (!twitter) twitter = website;
      website = "";
    }

    const space = parseSpaceNumber(spaceRaw);
    circles.push({
      id: `m3-${spaceRaw.replace(/\s+/g, "")}`,
      name,
      kana,
      space,
      genre: meta.tags[0] ?? "",
      description,
      urls: { website, twitter },
      tags: meta.tags,
    });
  }

  return { circles, sectionCount };
}

export function m3ToCatalogJson(result: M3ScrapeResult, eventName: string, eventDate: string): string {
  return JSON.stringify({
    schemaVersion: "1.0.0",
    catalog: {
      id: `m3-${eventDate}`,
      name: eventName,
      publisher: "M3 Webサイトから取込",
      publishedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    event: {
      name: eventName,
      date: eventDate,
      venue: "東京流通センター",
      dayNumber: 1,
    },
    circles: result.circles.map((c) => ({
      id: c.id,
      name: c.name,
      author: "",
      space: c.space,
      genre: c.genre,
      urls: { website: c.urls.website, twitter: c.urls.twitter, pixiv: "" },
      items: [],
      tags: c.tags,
      description: c.description,
    })),
    _editorMeta: { eventType: "m3" },
  }, null, 2);
}

export async function fetchM3Circles(sourceUrl: string): Promise<M3ScrapeResult> {
  // Try API proxy first, fall back to direct fetch
  let html: string;
  try {
    const res = await fetch(`/api/m3-scrape?url=${encodeURIComponent(sourceUrl)}`);
    if (!res.ok) throw new Error(`API proxy: ${res.status}`);
    html = await res.text();
  } catch {
    const res = await fetch(sourceUrl);
    if (!res.ok) throw new Error(`Direct fetch: ${res.status}`);
    html = await res.text();
  }
  return parseM3Html(html);
}
