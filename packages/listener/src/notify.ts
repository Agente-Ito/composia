const DISCORD_WEBHOOK = process.env.DISCORD_WEBHOOK_URL;

export async function notify(message: string): Promise<void> {
  if (!DISCORD_WEBHOOK) return;

  try {
    await fetch(DISCORD_WEBHOOK, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: message }),
    });
  } catch {
    // Notification failure should never crash the listener
  }
}
