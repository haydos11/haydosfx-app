export async function postDiscordSummary(discordText: string) {
  const webhookUrl = process.env.DISCORD_WEEKLY_WEBHOOK_URL;

  if (!webhookUrl) {
    throw new Error("DISCORD_WEEKLY_WEBHOOK_URL is not set");
  }

  const res = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content: discordText,
      allowed_mentions: { parse: [] },
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Discord webhook failed: ${res.status} ${body}`);
  }
}