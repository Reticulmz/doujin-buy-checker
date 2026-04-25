/// <reference types="@cloudflare/workers-types" />

const ALLOWED_HOSTS = ["www.m3net.jp", "m3net.jp"];

export const onRequestGet: PagesFunction = async (context) => {
  const url = new URL(context.request.url).searchParams.get("url");
  if (!url) {
    return new Response(JSON.stringify({ error: "url parameter required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid URL" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
    return new Response(JSON.stringify({ error: `Host not allowed: ${parsed.hostname}` }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "DoujinBuyChecker/1.0" },
    });
    if (!res.ok) {
      return new Response(JSON.stringify({ error: `M3 returned ${res.status}` }), {
        status: 502,
        headers: { "Content-Type": "application/json" },
      });
    }
    const html = await res.text();
    return new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
