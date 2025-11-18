import { google } from "googleapis";

export async function fetchGmailTasks(accessToken) {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  const gmail = google.gmail({ version: "v1", auth });

  const res = await gmail.users.messages.list({
    userId: "me",
    q: "is:unread OR label:STARRED",
    maxResults: 10,
  });

  if (!res.data.messages) return [];

  const emails = await Promise.all(
    res.data.messages.map(async (msg) => {
      const full = await gmail.users.messages.get({ userId: "me", id: msg.id });
      const subjectHeader = full.data.payload.headers.find((h) => h.name === "Subject");
      return {
        source: "Gmail",
        title: subjectHeader ? subjectHeader.value : "(no subject)",
        priority: "low",
      };
    })
  );

  return emails;
}

