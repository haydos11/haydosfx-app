export async function GET() {
  const url = process.env.KV_REST_API_URL || null;
  const token = process.env.KV_REST_API_TOKEN || null;

  return new Response(
    JSON.stringify({
      url,
      hasToken: Boolean(token),
      tokenLen: token ? token.length : 0,
    }),
    { headers: { "content-type": "application/json" } }
  );
}
