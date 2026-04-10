import { Router } from "express";
import archiver from "archiver";
import path from "path";
import { requireAdmin } from "../middlewares/requireAuth";

const router = Router();

// process.cwd() = artifacts/api-server when pnpm runs the package
// go up two levels to reach the workspace root
const WORKSPACE_ROOT = path.resolve(process.cwd(), "../..");

router.get("/admin/export", requireAdmin, (_req, res) => {
  const filename = `firesky-source-${new Date().toISOString().slice(0, 10)}.zip`;
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const archive = archiver("zip", { zlib: { level: 6 } });

  archive.on("error", () => {
    res.status(500).end();
  });

  archive.pipe(res);

  archive.glob("**/*", {
    cwd: WORKSPACE_ROOT,
    dot: true,
    ignore: [
      "**/node_modules/**",
      "**/.git/**",
      "**/dist/**",
      "**/.local/**",
      "**/data/**",
      "**/.pnpm-store/**",
      "**/*.log",
      "**/tmp/**",
    ],
  });

  archive.finalize();
});

export default router;
