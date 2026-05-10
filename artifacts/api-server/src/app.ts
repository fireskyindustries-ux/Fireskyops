import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import { clerkMiddleware } from "@clerk/express";
import { CLERK_PROXY_PATH, clerkProxyMiddleware } from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import mcpSseRouter from "./routes/mcp_sse";
import liveDataRouter from "./routes/live-data";
import portalAuthRouter from "./routes/portal-auth";
import portalTanksRouter from "./routes/portal-tanks";
import portalSkyRouter from "./routes/portal-sky";
import deviceIngestRouter from "./routes/device-ingest";
import { logger } from "./lib/logger";
import path from "path";
import { fileURLToPath } from "url";

const app: Express = express();

// Disable ETag — prevents Express returning empty 304 responses which break JSON parsing
app.disable("etag");

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

app.use(cors({ credentials: true, origin: true }));
app.use(cookieParser());
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ extended: true, limit: "25mb" }));

// Prevent 304 Not Modified on API routes — JSON responses must always have a body
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store");
  next();
});

// ── Temporary: one-time DB backup download ────────────────────────────────────
app.get("/api/dl-backup-fs2026", (_req, res) => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const file = path.resolve(__dirname, "../firesky-backup.sql");
  res.setHeader("Content-Disposition", "attachment; filename=firesky-backup.sql");
  res.setHeader("Content-Type", "application/octet-stream");
  res.sendFile(file);
});

// ── Temporary: one-time app bundle download ───────────────────────────────────
app.get("/api/dl-app-fs2026", (_req, res) => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const file = path.resolve(__dirname, "../firesky-production.tar.gz");
  res.setHeader("Content-Disposition", "attachment; filename=firesky-production.tar.gz");
  res.setHeader("Content-Type", "application/octet-stream");
  res.sendFile(file);
});

// ── Temporary: serve just the fixed index.mjs bundle ─────────────────────────
app.get("/api/dl-bundle-fs2026", (_req, res) => {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const file = path.resolve(__dirname, "./index.mjs");
  res.setHeader("Content-Disposition", "attachment; filename=index.mjs");
  res.setHeader("Content-Type", "application/octet-stream");
  res.sendFile(file);
});

// MCP SSE routes — public, mounted before Clerk middleware
app.use("/api", mcpSseRouter);

// Live data endpoint — API key protected, no Clerk auth needed
app.use("/api", liveDataRouter);

// Device ingest — IoT API key auth, no Clerk
app.use("/api", deviceIngestRouter);

app.use(clerkMiddleware());

// Portal routes — Clerk JWT auth (same session as field ops app)
app.use("/api/portal", portalAuthRouter);
app.use("/api/portal", portalTanksRouter);
app.use("/api/portal", portalSkyRouter);

app.use("/api", router);

// ── Production: serve built React apps as static files ────────────────────────
if (process.env.NODE_ENV === "production") {
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const publicDir = path.resolve(__dirname, "../public");

  // Sky Vision — must come before root so /sky-vision/* is matched first
  app.use(
    "/sky-vision",
    express.static(path.join(publicDir, "sky-vision"), { index: "index.html" }),
  );
  app.use("/sky-vision", (_req, res) => {
    res.sendFile(path.join(publicDir, "sky-vision", "index.html"));
  });

  // Firesky — root catch-all
  app.use(express.static(publicDir, { index: "index.html" }));
  app.use((_req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

export default app;
