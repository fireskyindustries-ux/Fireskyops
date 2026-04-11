import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import http from "node:http";

const FIRESKY_URL = "https://field-ops-manager-leemanski2.replit.app/api/ingest/firevision";

function createServer() {
  const server = new McpServer({
    name: "firevision-mcp",
    version: "1.0.0",
  });

  server.tool(
    "submit_firevision_enquiry",
    "Submit a customer enquiry captured by Fire Vision to Firesky Industries",
    {
      name:                 z.string().describe("Customer full name (required)"),
      phone:                z.string().optional().describe("Customer phone number — used to avoid duplicate customers"),
      location:             z.string().optional().describe("Customer location or site address"),
      problem_need:         z.string().optional().describe("Customer's problem or need"),
      recommended_solution: z.string().optional().describe("Recommended solution"),
      additional_notes:     z.string().optional().describe("Any additional notes"),
      source:               z.string().optional().describe("Source of the enquiry, e.g. 'Fire Vision'"),
      priority:             z.enum(["low", "medium", "high"]).optional().describe("Priority: low, medium, or high"),
      status:               z.string().optional().describe("Enquiry status (defaults to 'new')"),
    },
    async (params) => {
      try {
        const response = await fetch(FIRESKY_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(params),
        });

        const data = await response.json();

        return {
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        };
      } catch (err) {
        return {
          content: [{ type: "text", text: `Error: ${err.message}` }],
          isError: true,
        };
      }
    },
  );

  return server;
}

const PORT = process.env.PORT || 3001;
const useHttp = process.env.MCP_HTTP === "true" || !!process.env.PORT;

if (useHttp) {
  const sessions = new Map();

  const httpServer = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost:${PORT}`);

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === "GET" && url.pathname === "/sse") {
      const transport = new SSEServerTransport("/messages", res);
      sessions.set(transport.sessionId, transport);

      transport.onclose = () => {
        sessions.delete(transport.sessionId);
      };

      const server = createServer();
      await server.connect(transport);
      return;
    }

    if (req.method === "POST" && url.pathname === "/messages") {
      const sessionId = url.searchParams.get("sessionId");
      const transport = sessions.get(sessionId);

      if (!transport) {
        res.writeHead(404, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: "Session not found" }));
        return;
      }

      await transport.handlePostMessage(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/") {
      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(`<!DOCTYPE html><html><head><title>Fire Vision MCP Server</title></head><body>
<h1>Fire Vision MCP Server</h1>
<p>SSE endpoint: <code>/mcp/sse</code></p>
<p>Messages endpoint: <code>/mcp/messages</code></p>
</body></html>`);
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`[firevision-mcp] HTTP server listening on port ${PORT}`);
    console.log(`[firevision-mcp] SSE endpoint: http://localhost:${PORT}/sse`);
  });
} else {
  const transport = new StdioServerTransport();
  const server = createServer();
  await server.connect(transport);
}
