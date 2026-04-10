import { Router } from "express";
import archiver from "archiver";
import path from "path";
import { getAuth } from "@clerk/express";

const router = Router();

const WORKSPACE_ROOT = path.resolve(__dirname, "../../../..");

router.get("/api/admin/export", (req, res) => {
  const auth = getAuth(req);
  const claims = (auth?.sessionClaims as any) ?? {};
  const role = (claims?.publicMetadata?.role as string) || "guest";

  if (role !== "admin") {
    return res.status(403).json({ error: "Admin access required" });
  }

  const filename = `firesky-source-${new Date().toISOString().slice(0, 10)}.zip`;
  res.setHeader("Content-Type", "application/zip");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);

  const archive = archiver("zip", { zlib: { level: 6 } });

  archive.on("error", (err) => {
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
