import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },

    // OAuth tokens
    githubToken: { type: String, default: "" },
    gmailToken: { type: String, default: "" },
    slackToken: { type: String, default: "" },
  },
  { timestamps: true }
);

export default mongoose.model("User", userSchema);
