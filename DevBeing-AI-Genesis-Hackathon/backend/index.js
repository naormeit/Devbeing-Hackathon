// ------------------- ENV -------------------
import dotenv from "dotenv";
dotenv.config();

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

// OAuth Routes
import slackAuthRoutes from "./auth/slack.js";

// ------------------- EXPRESS APP -------------------
const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "*" }));
app.use(express.json());

// Mount Slack OAuth routes
app.use("/auth", slackAuthRoutes);

// Root test route
app.get("/", (req, res) => {
  res.send("Backend is running ✔");
});

// -----------------------------------------------------
// 🟣 SECURE ASYNC SERVER BOOTSTRAP (Fixes silent crashes)
// -----------------------------------------------------

(async () => {
  try {
    console.log("⏳ Connecting to MongoDB...");
    await mongoose.connect(process.env.MONGO_URI);
    console.log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB Connection Error:", err);
  }

  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () =>
    console.log(`🚀 Backend running on http://localhost:${PORT}`)
  );
})();
