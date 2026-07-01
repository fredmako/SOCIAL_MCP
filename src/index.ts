import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import dotenv from "dotenv";
import { createServer, IncomingMessage, ServerResponse } from "node:http";

dotenv.config();

// ---- Config / env ----
const PORT = Number(process.env.PORT) || 3000;
const MCP_SHARED_SECRET = process.env.MCP_SHARED_SECRET;

function getFreshTwitterToken(): string {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) {
    throw new Error("TWITTER_BEARER_TOKEN not found in environment variables");
  }
  return token;
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
  }
);

server.registerTool(
  "get_recent_posts",
  {
    description: "Get the user's recent posts from X/Twitter",
    inputSchema: z.object({ count: z.number().min(1).max(20).default(5) }),
  },
  async ({ count }: { count: number }) => {
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
      { headers: { Authorization: `Bearer ${token}` } }
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
  }
);

// ---- Start server over HTTP with shared-secret check ----
const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: undefined,
});

const httpServer = createServer(async (req: IncomingMessage, res: ServerResponse) => {
  // Shared-secret check
  if (MCP_SHARED_SECRET) {
    const auth = req.headers.authorization;
    if (auth !== `Bearer ${MCP_SHARED_SECRET}`) {
      res.writeHead(401, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unauthorized: invalid or missing MCP secret" }));
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
