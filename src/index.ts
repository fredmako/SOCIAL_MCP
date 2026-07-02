import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import dotenv from "dotenv";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

dotenv.config();

// ---- Config / env ----
const PORT = Number(process.env.PORT) || 3000;
const MCP_SHARED_SECRET = process.env.MCP_SHARED_SECRET;

function getBearerToken(): string {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) {
    throw new Error("TWITTER_BEARER_TOKEN not found in environment variables");
  }
  return token;
}

function getTwitterClient() {
  const appKey = process.env.TWITTER_CONSUMER_KEY;
  const appSecret = process.env.TWITTER_CONSUMER_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  if (!appKey || !appSecret || !accessToken || !accessSecret) {
    throw new Error("Missing OAuth 1.0a credentials for posting tweets");
  }

  const { TwitterApi } = require("twitter-api-v2");
  return new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
}

// ---- Server + tools ----
const server = new McpServer(
  { name: "social-mcp", version: "1.0.0" },
  {
    capabilities: { tools: {} },
  }
);

server.registerTool(
  "post_tweet",
  {
    description: "Post a tweet to X/Twitter on the user's behalf",
    inputSchema: z.object({ text: z.string().max(280) }),
  },
  async ({ text }: { text: string }) => {
    try {
      const client = getTwitterClient();
      const { data } = await client.v2.tweet(text);
      return { content: [{ type: "text", text: `Posted: ${data.id}` }] };
    } catch (err: any) {
      const message = err?.data?.detail || err?.message || "Unknown error";
      return { content: [{ type: "text", text: `Twitter error: ${message}` }], isError: true };
    }
  }
);

server.registerTool(
  "get_recent_posts",
  {
    description: "Get recent tweets for a user",
    inputSchema: z.object({ 
      userId: z.string().min(1),
      count: z.number().min(1).max(20).default(5) 
    }),
  },
  async ({ userId, count }: { userId: string; count?: number }) => {
    try {
      const token = getBearerToken();
      const safeCount = count ?? 5;
      
      const res = await fetch(
        `https://api.twitter.com/2/users/${userId}/tweets?max_results=${safeCount}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (!res.ok) {
        return { content: [{ type: "text", text: `Twitter API error: ${res.status}` }], isError: true };
      }

      const data = (await res.json()) as { data?: Array<{ text: string }> };
      const tweets = data?.data?.map(t => t.text).join("\n\n") || "No tweets found";
      return { content: [{ type: "text", text: tweets }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Failed: ${err?.message || err}` }], isError: true };
    }
  }
);

// ---- Start server over HTTP with shared-secret check ----
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
});

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  if (MCP_SHARED_SECRET) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${MCP_SHARED_SECRET}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized" }));
      return;
    }
  }
  await transport.handleRequest(req, res);
});

(async () => {
  await server.connect(transport);
})();

httpServer.listen(PORT, () => {
  console.log(`social-mcp server listening on port ${PORT}`);
});
