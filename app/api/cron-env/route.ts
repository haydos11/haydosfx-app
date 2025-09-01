// app/api/cron-env/route.ts
export async function GET() {
  const v = process.env.CRON_KEY || "";
  return new Response(
    JSON.stringify({ hasCronKey: Boolean(v), len: v.length }),
    { headers: { "content-type": "application/json" } }
  );
}
