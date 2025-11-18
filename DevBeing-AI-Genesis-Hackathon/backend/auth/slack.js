import express from "express";
import fetch from "node-fetch";

const router = express.Router();

// Slack Login – Redirect user to Slack OAuth
router.get("/slack/login", (req, res) => {
  const redirectUrl = `https://slack.com/oauth/v2/authorize?client_id=${process.env.SLACK_CLIENT_ID}&scope=channels:history,chat:write,users:read&redirect_uri=${process.env.SLACK_REDIRECT_URI}`;
  res.redirect(redirectUrl);
});

// Slack Callback – Exchange code for token
router.get("/slack/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const response = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        redirect_uri: process.env.SLACK_REDIRECT_URI,
      }),
    });

    const data = await response.json();
    res.json({ success: true, slackToken: data.access_token });
  } catch (err) {
    console.error("Slack OAuth Error:", err);
    res.status(500).json({ success: false, message: "Slack OAuth failed" });
  }
});

export default router;
