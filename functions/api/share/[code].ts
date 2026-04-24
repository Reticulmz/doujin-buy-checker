interface Env {
  SHARE_KV: KVNamespace;
}

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const code = context.params.code as string;

  if (!/^[A-Z0-9]{4,8}$/.test(code)) {
    return new Response(JSON.stringify({ error: "Invalid code" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const data = await context.env.SHARE_KV.get(`share:${code}`);

  if (!data) {
    return new Response(JSON.stringify({ error: "Not found or expired" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ data }), {
    headers: { "Content-Type": "application/json" },
  });
};
