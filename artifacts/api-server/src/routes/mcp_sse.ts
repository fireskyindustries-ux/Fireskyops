import { Router } from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { randomUUID } from "node:crypto";

const router = Router();

const FIRESKY_URL = "https://field-ops-manager-leemanski2.replit.app/api/ingest/firevision";

// Session store — keyed by mcp-session-id header value
const sessions = new Map<string, StreamableHTTPServerTransport>();

function createMcpServer(): McpServer {
  const server = new McpServer({
    name: "firevision-mcp",
    version: "1.0.0",
  });

  server.tool(
    "submit_firevision_enquiry",
    "Submit a customer enquiry captured by Fire Vision to Firesky Industries",
    {
      name:                 z.string().describe("Customer full name (required)"),
      email:                z.string().describe("Customer email address (required)"),
      phone:                z.string().optional().describe("Customer phone number"),
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
        return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        return { content: [{ type: "text", text: `Error: ${msg}` }], isError: true };
      }
    },
  );

  return server;
}

router.all("/mcp", async (req, res): Promise<void> => {
  const sessionId = req.headers["mcp-session-id"] as string | undefined;

  // Reuse existing session if available
  if (sessionId && sessions.has(sessionId)) {
    const transport = sessions.get(sessionId)!;
    await transport.handleRequest(req, res, req.body);
    return;
  }

  // New connection — create a transport + server pair
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: () => randomUUID(),
  });

  const server = createMcpServer();
  await server.connect(transport);

  // Clean up session when the transport closes
  transport.onclose = () => {
    if (transport.sessionId) {
      sessions.delete(transport.sessionId);
    }
  };

  // Process the request (sets transport.sessionId on initialize)
  await transport.handleRequest(req, res, req.body);

  // Register session for subsequent requests
  if (transport.sessionId) {
    sessions.set(transport.sessionId, transport);
  }
});

export default router;
