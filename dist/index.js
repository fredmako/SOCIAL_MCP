"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const mcp_js_1 = require("@modelcontextprotocol/sdk/server/mcp.js");
const streamableHttp_js_1 = require("@modelcontextprotocol/sdk/server/streamableHttp.js");
const zod_1 = require("zod");
const dotenv_1 = __importDefault(require("dotenv"));
const node_http_1 = require("node:http");
dotenv_1.default.config();
// ---- Config / env ----
const PORT = Number(process.env.PORT) || 3000;
const MCP_SHARED_SECRET = process.env.MCP_SHARED_SECRET;
function getBearerToken() {
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
const postTweetInputSchema = zod_1.z.object({ text: zod_1.z.string().max(280) });
const getRecentPostsInputSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1),
    count: zod_1.z.number().min(1).max(20).default(5),
});
// ---- Start server over HTTP with shared-secret check ----
function buildServer() {
    const server = new mcp_js_1.McpServer({ name: "social-mcp", version: "1.0.0" }, {
        capabilities: { tools: {} },
    });
    server.registerTool("post_tweet", {
        description: "Post a tweet to X/Twitter on the user's behalf",
        inputSchema: postTweetInputSchema,
    }, async (args) => {
        try {
            const { text } = args;
            const client = getTwitterClient();
            const { data } = await client.v2.tweet(text);
            return { content: [{ type: "text", text: `Posted: ${data.id}` }] };
        }
        catch (err) {
            const message = err?.data?.detail || err?.message || "Unknown error";
            return { content: [{ type: "text", text: `Twitter error: ${message}` }], isError: true };
        }
    });
    server.registerTool("get_recent_posts", {
        description: "Get recent tweets for a user",
        inputSchema: getRecentPostsInputSchema,
    }, async (args) => {
        try {
            const { userId, count } = args;
            const token = getBearerToken();
            const safeCount = count ?? 5;
            const res = await fetch(`https://api.twitter.com/2/users/${userId}/tweets?max_results=${safeCount}`, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) {
                return { content: [{ type: "text", text: `Twitter API error: ${res.status}` }], isError: true };
            }
            const data = (await res.json());
            const tweets = data?.data?.map((t) => t.text).join("\n\n") || "No tweets found";
            return { content: [{ type: "text", text: tweets }] };
        }
        catch (err) {
            return { content: [{ type: "text", text: `Failed: ${err?.message || err}` }], isError: true };
        }
    });
    return server;
}
const httpServer = (0, node_http_1.createServer)(async (req, res) => {
    try {
        if (MCP_SHARED_SECRET) {
            const auth = req.headers.authorization;
            if (auth !== `Bearer ${MCP_SHARED_SECRET}`) {
                res.writeHead(401, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ error: "Unauthorized" }));
                return;
            }
        }
        const server = buildServer();
        const transport = new streamableHttp_js_1.StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
        });
        await server.connect(transport);
        await transport.handleRequest(req, res);
    }
    catch (err) {
        console.error("MCP request error:", err);
        if (!res.headersSent) {
            res.writeHead(500, { "Content-Type": "application/json" });
            res.end(JSON.stringify({
                jsonrpc: "2.0",
                error: {
                    code: -32603,
                    message: "Internal server error",
                },
                id: null,
            }));
        }
    }
});
httpServer.listen(PORT, () => {
    console.log(`social-mcp server listening on port ${PORT}`);
});
