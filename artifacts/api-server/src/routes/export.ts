import { Router } from "express";
import archiver from "archiver";
import path from "path";
import fs from "fs";
import { requireAdmin } from "../middlewares/requireAuth";

const router = Router();

// Find the workspace root by searching for pnpm-workspace.yaml upward from cwd.
// In dev: cwd = artifacts/api-server → needs to go up 2 levels.
// In production: cwd = workspace root → already correct.
function findWorkspaceRoot(): string {
  let dir = process.cwd();
  for (let i = 0; i < 4; i++) {
    if (fs.existsSync(path.join(dir, "pnpm-workspace.yaml"))) {
      return dir;
    }
    const parent = path.resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return process.cwd();
}

router.get("/admin/export", requireAdmin, (_req, res) => {
  const workspaceRoot = findWorkspaceRoot();
  const filename = `firesky-source-${new Date().toISOString().slice(0, 10)}.zip`;
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const archive = archiver("zip", { zlib: { level: 6 } });

  archive.on("error", () => {
    res.status(500).end();
  });

  archive.pipe(res);

  archive.glob("**/*", {
    cwd: workspaceRoot,
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
