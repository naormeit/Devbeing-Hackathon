import fetch from "node-fetch";

export async function fetchSlackTasks(slackToken) {
  const headers = { Authorization: `Bearer ${slackToken}`, "Content-Type": "application/json" };

  const res = await fetch("https://slack.com/api/conversations.history?channel=YOUR_CHANNEL_ID", { headers });
  const data = await res.json();
  if (!data.ok) return [];

  return data.messages.slice(0, 10).map((m) => ({
    source: "Slack",
    title: m.text,
    priority: "medium",
  }));
}
