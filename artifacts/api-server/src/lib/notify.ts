import { db, notificationsTable } from "@workspace/db";
import { clerkClient } from "@clerk/express";
import { logger } from "./logger";
import { sendPushToUsers } from "./push";

export async function getAdminUserIds(): Promise<string[]> {
  try {
    const { data: users } = await clerkClient.users.getUserList({ limit: 200 });
    return users
      .filter((u) => u.publicMetadata?.role === "admin")
      .map((u) => u.id);
  } catch (err) {
    logger.error({ err }, "Failed to fetch admin user IDs from Clerk");
    return [];
  }
}

export async function notifyUsers(
  userIds: string[],
  title: string,
  body: string | null,
  link: string | null
): Promise<void> {
  if (!userIds.length) return;
  try {
    await db.insert(notificationsTable).values(
      userIds.map((userId) => ({ userId, title, body, link }))
    );
    // Also fire browser push notifications (fire-and-forget)
    sendPushToUsers(userIds, { title, body: body ?? undefined, url: link ?? undefined });
  } catch (err) {
    logger.error({ err }, "Failed to create notifications");
  }
}

export async function notifyAdmins(
  title: string,
  body: string | null,
  link: string | null
): Promise<void> {
  const adminIds = await getAdminUserIds();
  await notifyUsers(adminIds, title, body, link);
}
