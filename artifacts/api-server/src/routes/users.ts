import { Router } from "express";
import { requireAdmin } from "../middlewares/requireAuth";
import { getAuth } from "@clerk/express";

const router = Router();

const clerkSecretKey = process.env.CLERK_SECRET_KEY!;

async function clerkFetch(path: string, options?: RequestInit) {
  const res = await fetch(`https://api.clerk.com/v1${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${clerkSecretKey}`,
      "Content-Type": "application/json",
      ...(options?.headers || {}),
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Clerk API error ${res.status}: ${text}`);
  }
  return res.json();
}

// Get current user's own role/profile info
router.get("/users/me", async (req: any, res) => {
  try {
    const auth = getAuth(req);
    const userId = auth?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const user = await clerkFetch(`/users/${userId}`);
    res.json({
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email_addresses?.[0]?.email_address,
      imageUrl: user.image_url,
      role: user.public_metadata?.role || "user",
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// List all users (admin only)
router.get("/users", requireAdmin, async (_req, res) => {
  try {
    const data = await clerkFetch("/users?limit=100&order_by=-created_at");
    const users = data.map((u: any) => ({
      id: u.id,
      firstName: u.first_name,
      lastName: u.last_name,
      email: u.email_addresses?.[0]?.email_address,
      imageUrl: u.image_url,
      role: u.public_metadata?.role || "user",
      createdAt: u.created_at,
      lastSignInAt: u.last_sign_in_at,
    }));
    res.json(users);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Update a user's role (admin only)
router.patch("/users/:userId/role", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;
    if (!["admin", "user"].includes(role)) {
      return res.status(400).json({ error: "Role must be 'admin' or 'user'" });
    }
    const user = await clerkFetch(`/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ public_metadata: { role } }),
    });
    res.json({ id: user.id, role: user.public_metadata?.role });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Send an invitation (admin only)
router.post("/users/invite", requireAdmin, async (req, res) => {
  try {
    const { email, role = "user" } = req.body;
    if (!email) return res.status(400).json({ error: "Email is required" });

    // Resolve the app URL for the invitation redirect — try several sources
    const appUrl =
      process.env.APP_URL ||
      process.env.VITE_APP_URL ||
      (process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(",")[0].trim()}` : null) ||
      (process.env.REPLIT_DEV_DOMAIN ? `https://${process.env.REPLIT_DEV_DOMAIN}` : null);

    const inviteBody: Record<string, unknown> = {
      email_address: email,
      public_metadata: { role },
    };
    if (appUrl) {
      inviteBody.redirect_url = appUrl;
    }

    const invitation = await clerkFetch("/invitations", {
      method: "POST",
      body: JSON.stringify(inviteBody),
    });
    res.json({ id: invitation.id, email: invitation.email_address });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// First-time setup: claim admin if no admins exist yet
router.post("/users/claim-admin", async (req: any, res) => {
  try {
    const auth = getAuth(req);
    const userId = auth?.userId;
    if (!userId) return res.status(401).json({ error: "Unauthorized" });
    const allUsers: any[] = await clerkFetch("/users?limit=100");
    const hasAdmin = allUsers.some((u) => u.public_metadata?.role === "admin");
    if (hasAdmin) {
      return res.status(403).json({ error: "An admin already exists. Ask your admin to grant you access." });
    }
    const user = await clerkFetch(`/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ public_metadata: { role: "admin" } }),
    });
    res.json({ success: true, role: user.public_metadata?.role });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Remove / delete a user (admin only)
router.delete("/users/:userId", requireAdmin, async (req, res) => {
  try {
    const { userId } = req.params;
    await clerkFetch(`/users/${userId}`, { method: "DELETE" });
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
