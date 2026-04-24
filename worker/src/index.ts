interface Env {
  SHARE_KV: KVNamespace;
}

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const MAX_DATA_SIZE = 1_000_000; // 1MB
const TTL_SECONDS = 86400; // 24 hours
const CODE_LENGTH = 6;
const RATE_LIMIT_PER_MINUTE = 10;

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Avoid confusing characters
  let code = "";
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

async function checkRateLimit(kv: KVNamespace, ip: string): Promise<boolean> {
  const key = `ratelimit:${ip}`;
  const current = await kv.get(key);
  const count = current ? parseInt(current, 10) : 0;
  if (count >= RATE_LIMIT_PER_MINUTE) return false;
  await kv.put(key, String(count + 1), { expirationTtl: 60 });
  return true;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS_HEADERS });
    }

    const url = new URL(request.url);
    const ip = request.headers.get("CF-Connecting-IP") || "unknown";

    // POST /api/share
    if (url.pathname === "/api/share" && request.method === "POST") {
      if (!(await checkRateLimit(env.SHARE_KV, ip))) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const body = await request.json<{ data: string }>();
      if (!body.data || body.data.length > MAX_DATA_SIZE) {
        return new Response(JSON.stringify({ error: "Invalid or too large data" }), {
          status: 400,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      const code = generateCode();
      const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();

      await env.SHARE_KV.put(`share:${code}`, body.data, {
        expirationTtl: TTL_SECONDS,
      });

      return new Response(JSON.stringify({ code, expiresAt }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    // GET /api/share/:code
    const shareMatch = url.pathname.match(/^\/api\/share\/([A-Z0-9]{4,8})$/);
    if (shareMatch && request.method === "GET") {
      const code = shareMatch[1];
      const data = await env.SHARE_KV.get(`share:${code}`);

      if (!data) {
        return new Response(JSON.stringify({ error: "Not found or expired" }), {
          status: 404,
          headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ data }), {
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  },
};
