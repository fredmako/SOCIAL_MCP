import { McpServer } from "@modelcontextprotocol/server";
import { serveHttp } from "@modelcontextprotocol/server/http";
import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

// ---- Config / env ----
const PORT = Number(process.env.PORT) || 3000;
const MCP_SHARED_SECRET = process.env.MCP_SHARED_SECRET; // required header for any caller

function getFreshTwitterToken(): string {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) {
    throw new Error("TWITTER_BEARER_TOKEN not found in environment variables");
  }
  return token;
}

// ---- Server + tools ----
const server = new McpServer({
  name: "social-mcp",
  version: "1.0.0",
});

server.registerTool(
  "post_tweet",
  {
    description: "Post a tweet to X/Twitter on the user's behalf",
    inputSchema: z.object({ text: z.string().max(280) }),
  },
  async ({ text }) => {
    const token = getFreshTwitterToken();
    const res = await fetch("https://api.twitter.com/2/tweets", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      throw new Error(`Twitter API error: ${res.status}`);
    }

    const data = (await res.json()) as { data: { id: string } };
    return { content: [{ type: "text", text: `Posted: ${data.data.id}` }] };
  },
);

server.registerTool(
  "get_recent_posts",
  {
    description: "Get the user's recent posts from X/Twitter",
    inputSchema: z.object({ count: z.number().min(1).max(20).default(5) }),
  },
  async ({ count }) => {
    const token = getFreshTwitterToken();

    // Get the authenticated user's ID first
    const userRes = await fetch("https://api.twitter.com/2/users/me", {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!userRes.ok) {
      throw new Error(`Twitter API error: ${userRes.status}`);
    }

    const userData = (await userRes.json()) as { data: { id: string } };
    const userId = userData.data.id;

    // Fetch recent tweets
    const tweetsRes = await fetch(
      `https://api.twitter.com/2/users/${userId}/tweets?max_results=${count}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );

    if (!tweetsRes.ok) {
      throw new Error(`Twitter API error: ${tweetsRes.status}`);
    }

    const tweetsData = (await tweetsRes.json()) as {
      data?: Array<{ text: string }>;
    };
    const tweets =
      tweetsData.data?.map((tweet) => tweet.text).join("\n") ||
      "No tweets found";

    return { content: [{ type: "text", text: tweets }] };
  },
);

// ---- Start server over HTTP, with a shared-secret check ----
serveHttp(server, {
  port: PORT,
  // Rejects any request that doesn't present the correct bearer secret.
  // Set MCP_SHARED_SECRET in your .env and put the same value in Notion's
  // custom header field as: Authorization: Bearer <secret>
  onRequest: (req) => {
    if (!MCP_SHARED_SECRET) return; // no secret configured, allow (dev only)
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${MCP_SHARED_SECRET}`) {
      throw new Error("Unauthorized: invalid or missing MCP secret");
    }
  },
});

console.log(`social-mcp server listening on port ${PORT}`);
