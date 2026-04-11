import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const FIRESKY_URL = "https://field-ops-manager-leemanski2.replit.app/api/ingest/firevision";

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

const transport = new StdioServerTransport();
await server.connect(transport);
