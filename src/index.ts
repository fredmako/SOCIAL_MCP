import express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import dotenv from "dotenv";
import { TwitterApi } from "twitter-api-v2";

dotenv.config();

/* -----------------------------
   Safety nets (keep in prod)
------------------------------*/
process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
});

process.on("unhandledRejection", (reason) => {
  console.error("UNHANDLED REJECTION:", reason);
});

/* -----------------------------
   Config
------------------------------*/
const PORT = Number(process.env.PORT) || 3000;
const MCP_SHARED_SECRET = process.env.MCP_SHARED_SECRET;

if (!MCP_SHARED_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("MCP_SHARED_SECRET must be set in production");
}

/* -----------------------------
   Twitter Auth Helpers
------------------------------*/

// App-only token (READ ONLY)
function getBearerToken(): string {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) throw new Error("Missing TWITTER_BEARER_TOKEN");
  return token;
}

// User-context OAuth 1.0a (WRITE)
function getTwitterClient(): TwitterApi {
  const appKey = process.env.TWITTER_CONSUMER_KEY;
  const appSecret = process.env.TWITTER_CONSUMER_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    throw new Error("Missing OAuth 1.0a credentials for posting tweets");
  }

  return new TwitterApi({
    appKey,
    appSecret,
    accessToken,
    accessSecret,
  });
}

/* -----------------------------
   Helper: fetch with timeout
------------------------------*/
async function fetchWithTimeout(url: string, options: RequestInit, ms = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), ms);

  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeout);
  }
}

/* -----------------------------
   MCP Server (created ONCE)
------------------------------*/
function buildServer(): McpServer {
  const server = new McpServer({
    name: "social-mcp",
    version: "1.0.0",
  });

  /* -------------------------
     TOOL: post tweet
  --------------------------*/
  server.registerTool(
    "post_tweet",
    {
      title: "Post Tweet",
      description: "Post a tweet to X/Twitter",
      inputSchema: {
        text: z.string().min(1).max(280),
      },
    },
    async ({ text }) => {
      try {
        const client = getTwitterClient();
        const { data } = await client.v2.tweet(text);

        return {
          content: [
            {
              type: "text",
              text: `Tweet posted successfully. ID: ${data.id}`,
            },
          ],
        };
      } catch (err: any) {
        const message =
          err?.data?.detail || err?.message || "Unknown Twitter error";

        return {
          content: [{ type: "text", text: `Twitter error: ${message}` }],
          isError: true,
        };
      }
    }
  );

  /* -------------------------
     TOOL: get recent tweets
     FIX: no /users/me dependency
  --------------------------*/
  server.registerTool(
    "get_recent_posts",
    {
      title: "Get Recent Posts",
      description: "Fetch recent tweets for a given user ID",
      inputSchema: {
        userId: z.string().min(1), // REQUIRED FIX
        count: z.number().min(1).max(20).optional(),
      },
    },
    async ({ userId, count }) => {
      try {
        const token = getBearerToken();
        const safeCount = count ?? 5;

        const tweetsRes = await fetchWithTimeout(
          `https://api.twitter.com/2/users/${userId}/tweets?max_results=${safeCount}`,
          {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          }
        );

        if (!tweetsRes.ok) {
          return {
            content: [
              {
                type: "text",
                text: `Twitter API error: ${tweetsRes.status}`,
              },
            ],
            isError: true,
          };
        }

        const data = (await tweetsRes.json()) as {
          data?: Array<{ text: string }>;
        };

        const tweets =
          data?.data?.map((t) => t.text).join("\n\n") ||
          "No tweets found";

        return {
          content: [{ type: "text", text: tweets }],
        };
      } catch (err: any) {
        return {
          content: [
            {
              type: "text",
              text: `Failed to fetch tweets: ${err?.message || err}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

/* -----------------------------
   Express App
------------------------------*/
const app = express();
app.use(express.json());

/* -----------------------------
   Auth middleware (strict)
------------------------------*/
app.use("/mcp", (req, res, next) => {
  if (!MCP_SHARED_SECRET) return next();

  const auth = req.headers.authorization;

  if (auth !== `Bearer ${MCP_SHARED_SECRET}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  next();
});

/* -----------------------------
   SINGLE server instance (FIX)
------------------------------*/
const server = buildServer();

/* -----------------------------
   MCP endpoint
------------------------------*/
app.post("/mcp", async (req, res) => {
  try {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });

    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (err) {
    console.error("MCP request error:", err);

    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal server error",
        },
        id: null,
      });
    }
  }
});

/* -----------------------------
   Start server
------------------------------*/
app.listen(PORT, () => {
  console.log(`social-mcp running on port ${PORT}`);
});
