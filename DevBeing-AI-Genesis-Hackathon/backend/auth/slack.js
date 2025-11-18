import express from "express";
import axios from "axios";
import querystring from "querystring";

const router = express.Router();

const clientId = process.env.SLACK_CLIENT_ID;
const clientSecret = process.env.SLACK_CLIENT_SECRET;
const redirectUrl = process.env.SLACK_REDIRECT_URL;

// Step 1: Redirect user to Slack Login
router.get("/slack", (req, res) => {
  const url = `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=identity.basic,identity.email,identity.avatar,identity.team&redirect_uri=${redirectUrl}`;
  res.redirect(url);
});

// Step 2: Slack redirects user back here with ?code=
router.get("/slack/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const response = await axios.post(
      "https://slack.com/api/oauth.v2.access",
      querystring.stringify({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUrl,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const data = response.data;

    if (!data.ok) {
      return res.status(400).json({ error: data.error });
    }

    // Slack user information
    const user = {
      id: data.authed_user.id,
      token: data.authed_user.access_token,
      team: data.team.name,
    };

    // Redirect user back to your frontend with Slack auth success
    res.redirect(`${process.env.CLIENT_URL}/dashboard?slack=success`);
  } catch (error) {
    console.error("Slack OAuth Error:", error.message);
    res.redirect(`${process.env.CLIENT_URL}/dashboard?slack=failed`);
  }
});

export default router;
