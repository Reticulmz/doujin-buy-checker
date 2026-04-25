/// <reference types="@cloudflare/workers-types" />

interface Env {
  SHARE_KV: KVNamespace;
}

const MAX_DATA_SIZE = 1_000_000;
const TTL_SECONDS = 86400;
const CODE_LENGTH = 6;
const RATE_LIMIT_PER_MINUTE = 10;

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
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

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";

  if (!(await checkRateLimit(env.SHARE_KV, ip))) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = await request.json<{ data: string }>();
  if (!body.data || body.data.length > MAX_DATA_SIZE) {
    return new Response(JSON.stringify({ error: "Invalid or too large data" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const code = generateCode();
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();

  await env.SHARE_KV.put(`share:${code}`, body.data, {
    expirationTtl: TTL_SECONDS,
  });

  return new Response(JSON.stringify({ code, expiresAt }), {
    headers: { "Content-Type": "application/json" },
  });
};
