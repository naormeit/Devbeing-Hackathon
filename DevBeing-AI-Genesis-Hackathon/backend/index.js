app.get("/", (req, res) => {
  res.send("Backend is running ✔");
});

// ------------------- ENV -------------------
import dotenv from "dotenv";
dotenv.config();

import slackAuthRoutes from "./auth/slack.js";
app.use("/auth", slackAuthRoutes);


// ------------------- IMPORTS -------------------
import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fetch from "node-fetch";
import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";

// Models & Integrations
import User from "./models/User.js";
import Task from "./models/Task.js";
import { fetchGithubTasks } from "./integrations/github.js";
import { fetchGmailTasks } from "./integrations/gmail.js";
import { fetchSlackTasks } from "./integrations/slack.js";

// ------------------- EXPRESS APP -------------------
const app = express();
app.use(cors({ origin: "http://localhost:5173" }));
app.use(express.json());

// ------------------- MONGODB -------------------
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

// ------------------- CLAUDE 3 OPUS -------------------
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ------------------- GOOGLE OAUTH -------------------
const googleOAuth = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// ====================================================================
//                          AUTH LOGIN / SIGNUP
// ====================================================================
app.post("/api/login", async (req, res) => {
  const {
    name,
    email,
    password,
    isLogin,
    githubToken,
    gmailToken,
    slackToken,
  } = req.body;

  if (!email || !password)
    return res.json({ success: false, message: "Missing credentials" });

  try {
    if (isLogin) {
      // LOGIN
      const user = await User.findOne({ email });
      if (!user) return res.json({ success: false, message: "User not found" });

      const match = await bcrypt.compare(password, user.password);
      if (!match)
        return res.json({ success: false, message: "Wrong password" });

      // Update OAuth tokens
      if (githubToken || gmailToken || slackToken) {
        user.githubToken = githubToken || user.githubToken;
        user.gmailToken = gmailToken || user.gmailToken;
        user.slackToken = slackToken || user.slackToken;
        await user.save();
      }

      const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      return res.json({ success: true, user, token });
    } else {
      // SIGNUP
      const existing = await User.findOne({ email });
      if (existing)
        return res.json({
          success: false,
          message: "Email already registered",
        });

      const hashed = await bcrypt.hash(password, 10);

      const newUser = await User.create({
        name,
        email,
        password: hashed,
        githubToken,
        gmailToken,
        slackToken,
      });

      const token = jwt.sign({ id: newUser._id }, process.env.JWT_SECRET, {
        expiresIn: "7d",
      });

      return res.json({ success: true, user: newUser, token });
    }
  } catch (err) {
    console.error("Auth error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ====================================================================
//                          GITHUB OAUTH
// ====================================================================
app.get("/api/auth/github/login", (req, res) => {
  const redirect = `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${process.env.GITHUB_CALLBACK_URL}&scope=repo,user`;
  res.redirect(redirect);
});

app.get("/api/auth/github/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const tokenRes = await fetch(
      "https://github.com/login/oauth/access_token",
      {
        method: "POST",
        headers: { Accept: "application/json" },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code,
        }),
      }
    );

    const tokenData = await tokenRes.json();
    res.json({ success: true, githubToken: tokenData.access_token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "GitHub OAuth failed" });
  }
});

// ====================================================================
//                          GOOGLE (GMAIL) OAUTH
// ====================================================================
app.get("/api/auth/google/login", (req, res) => {
  const url = googleOAuth.generateAuthUrl({
    access_type: "offline",
    scope: ["https://www.googleapis.com/auth/gmail.readonly"],
  });
  res.redirect(url);
});

app.get("/api/auth/google/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const { tokens } = await googleOAuth.getToken(code);
    res.json({ success: true, gmailToken: tokens.access_token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Google OAuth failed" });
  }
});

// ====================================================================
//                          SLACK OAUTH
// ====================================================================
app.get("/api/auth/slack/login", (req, res) => {
  const redirect = `https://slack.com/oauth/v2/authorize?client_id=${process.env.SLACK_CLIENT_ID}&scope=channels:history,chat:write,users:read&redirect_uri=${process.env.SLACK_REDIRECT_URI}`;
  res.redirect(redirect);
});

app.get("/api/auth/slack/callback", async (req, res) => {
  const code = req.query.code;

  try {
    const tokenRes = await fetch("https://slack.com/api/oauth.v2.access", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.SLACK_CLIENT_ID,
        client_secret: process.env.SLACK_CLIENT_SECRET,
        redirect_uri: process.env.SLACK_REDIRECT_URI,
      }),
    });

    const data = await tokenRes.json();
    res.json({ success: true, slackToken: data.access_token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Slack OAuth failed" });
  }
});

// ====================================================================
//                        AUTH MIDDLEWARE
// ====================================================================
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(" ")[1];

  if (!token) return res.status(401).json({ message: "No token" });

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({ message: "Invalid token" });
  }
}

// ====================================================================
//                        TASK ROUTES
// ====================================================================
app.get("/api/tasks", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    const dbTasks = await Task.find({ userId: req.user.id });

    const [gitTasks, gmailTasks, slackTasks] = await Promise.all([
      user.githubToken ? fetchGithubTasks(user.githubToken, user.name) : [],
      user.gmailToken ? fetchGmailTasks(user.gmailToken) : [],
      user.slackToken ? fetchSlackTasks(user.slackToken) : [],
    ]);

    const allTasks = [
      ...dbTasks.map((t) => ({
        source: "Local",
        title: t.title,
        priority: t.priority,
        completed: t.completed,
      })),
      ...gitTasks,
      ...gmailTasks,
      ...slackTasks,
    ];

    res.json(allTasks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Failed to load tasks" });
  }
});

app.post("/api/tasks", authMiddleware, async (req, res) => {
  try {
    const { title, priority, time } = req.body;

    const newTask = await Task.create({
      userId: req.user.id,
      title,
      priority,
      time,
    });

    res.json(newTask);
  } catch {
    res.status(500).json({ message: "Failed to create task" });
  }
});

app.put("/api/tasks/:id", authMiddleware, async (req, res) => {
  try {
    const { completed } = req.body;

    const updated = await Task.findByIdAndUpdate(
      req.params.id,
      { completed },
      { new: true }
    );

    res.json(updated);
  } catch {
    res.status(500).json({ message: "Failed to update task" });
  }
});

app.delete("/api/tasks/:id", authMiddleware, async (req, res) => {
  try {
    await Task.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch {
    res.status(500).json({ message: "Failed to delete task" });
  }
});

// ====================================================================
//                        AI SUMMARY (CLAUDE 3 OPUS)
// ====================================================================
app.post("/api/ai/summary", authMiddleware, async (req, res) => {
  try {
    const { tasks } = req.body;

    if (!tasks?.length)
      return res.json({ summary: "No tasks to summarize." });

    const taskText = tasks
      .map((t, i) => `${i + 1}. ${t.title} [${t.source}] - ${t.priority}`)
      .join("\n");

    const prompt = `
You are a productivity assistant.
Summarize and prioritize these developer tasks clearly:

${taskText}

Return a 3–4 sentence summary.
`;

    const response = await anthropic.messages.create({
      model: "claude-3-opus-20240229",
      max_tokens: 400,
      messages: [{ role: "user", content: prompt }],
    });

    res.json({ summary: response.content[0].text });
  } catch (err) {
    console.error("AI summary error:", err);
    res.status(500).json({ message: "Failed to generate summary" });
  }
});

// ====================================================================
//                            SERVER START
// ====================================================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Backend running on http://localhost:${PORT}`)
);
