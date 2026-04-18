import webpush from "web-push";
import { db, pushSubscriptionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { brand } from "../brand.config";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_EMAIL = process.env.VAPID_EMAIL || brand.supportEmail;

let initialized = false;

function init() {
  if (initialized) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    logger.warn("VAPID keys not set — browser push notifications disabled");
    return false;
  }
  webpush.setVapidDetails(`mailto:${VAPID_EMAIL}`, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  initialized = true;
  return true;
}

export function getVapidPublicKey() {
  return VAPID_PUBLIC_KEY || null;
}

export async function sendPushToUsers(
  userIds: string[],
  payload: { title: string; body?: string; url?: string }
): Promise<void> {
  if (!init() || !userIds.length) return;

  const subscriptions = await db
    .select()
    .from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.userId, userIds[0]));

  // Gather all subscriptions for all userIds
  const allSubs = await Promise.all(
    userIds.map((uid) =>
      db
        .select()
        .from(pushSubscriptionsTable)
        .where(eq(pushSubscriptionsTable.userId, uid))
    )
  );
  const subs = allSubs.flat();

  if (!subs.length) return;

  const payloadStr = JSON.stringify(payload);
  const results = await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payloadStr
        );
      } catch (err: any) {
        // 410 Gone = subscription expired, remove it
        if (err.statusCode === 410) {
          await db
            .delete(pushSubscriptionsTable)
            .where(eq(pushSubscriptionsTable.endpoint, sub.endpoint));
          logger.info({ endpoint: sub.endpoint }, "Removed expired push subscription");
        } else {
          throw err;
        }
      }
    })
  );

  const failed = results.filter((r) => r.status === "rejected");
  if (failed.length) {
    logger.error({ count: failed.length }, "Some push notifications failed");
  }
}
