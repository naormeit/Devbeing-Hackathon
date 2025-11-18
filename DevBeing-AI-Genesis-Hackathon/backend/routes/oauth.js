import express from "express";
import axios from "axios";
import User from "../models/User.js";
import jwt from "jsonwebtoken";

const router = express.Router();

// --- GITHUB OAUTH ---
router.get("/github", (req, res) => {
  const redirect = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&scope=repo,user:email`;
  res.redirect(redirect);
});

router.get("/github/callback", async (req, res) => {
  const { code, state } = req.query;

  try {
    const tokenResponse = await axios.post(
      "https://github.com/login/oauth/access_token",
      {
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
      },
      { headers: { Accept: "application/json" } }
    );

    const accessToken = tokenResponse.data.access_token;

    // Example: decode state for user ID (if JWT used)
    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user) {
      user.githubToken = accessToken;
      await user.save();
    }

    return res.send(
      `<script>alert('✅ GitHub connected successfully!'); window.close();</script>`
    );
  } catch (error) {
    console.error("GitHub OAuth Error:", error);
    res.send("<script>alert('❌ GitHub authentication failed'); window.close();</script>");
  }
});

// --- GMAIL OAUTH ---
router.get("/gmail", (req, res) => {
  const redirect = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${process.env.GOOGLE_REDIRECT_URI}&response_type=code&scope=https://www.googleapis.com/auth/gmail.readonly&access_type=offline`;
  res.redirect(redirect);
});

router.get("/gmail/callback", async (req, res) => {
  const { code, state } = req.query;

  try {
    const response = await axios.post("https://oauth2.googleapis.com/token", {
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: process.env.GOOGLE_REDIRECT_URI,
      grant_type: "authorization_code",
      code,
    });

    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user) {
      user.gmailToken = response.data.access_token;
      await user.save();
    }

    return res.send(
      `<script>alert('✅ Gmail connected successfully!'); window.close();</script>`
    );
  } catch (error) {
    console.error("Gmail OAuth Error:", error);
    res.send("<script>alert('❌ Gmail authentication failed'); window.close();</script>");
  }
});

// --- SLACK OAUTH ---
router.get("/slack", (req, res) => {
  const redirect = `https://slack.com/oauth/v2/authorize?client_id=${process.env.SLACK_CLIENT_ID}&scope=channels:read,chat:write,users:read&redirect_uri=${process.env.SLACK_REDIRECT_URI}`;
  res.redirect(redirect);
});

router.get("/slack/callback", async (req, res) => {
  const { code, state } = req.query;

  try {
    const response = await axios.post(
      "https://slack.com/api/oauth.v2.access",
      null,
      {
        params: {
          code,
          client_id: process.env.SLACK_CLIENT_ID,
          client_secret: process.env.SLACK_CLIENT_SECRET,
          redirect_uri: process.env.SLACK_REDIRECT_URI,
        },
      }
    );

    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (user) {
      user.slackToken = response.data.access_token;
      await user.save();
    }

    return res.send(
      `<script>alert('✅ Slack connected successfully!'); window.close();</script>`
    );
  } catch (error) {
    console.error("Slack OAuth Error:", error);
    res.send("<script>alert('❌ Slack authentication failed'); window.close();</script>");
  }
});

export default router;
