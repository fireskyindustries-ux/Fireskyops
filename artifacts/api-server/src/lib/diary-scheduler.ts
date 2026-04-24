import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { sendPushToUsers } from "./push";
import { logger } from "./logger";

const INTERVAL_MS = 5 * 60 * 1000; // every 5 minutes
const LOOKAHEAD_MINUTES = 15;

export function startDiaryScheduler() {
  async function check() {
    try {
      const now = new Date();
      const windowEnd = new Date(now.getTime() + LOOKAHEAD_MINUTES * 60 * 1000);

      // Find upcoming events that haven't been notified yet
      const rows = await db.execute<any>(sql`
        SELECT id, user_id, title, description, start_at, location, all_day
        FROM sky_diary_events
        WHERE status = 'scheduled'
          AND all_day = FALSE
          AND start_at > ${now.toISOString()}::timestamptz
          AND start_at <= ${windowEnd.toISOString()}::timestamptz
          AND (notified_at IS NULL OR notified_at < ${new Date(now.getTime() - 60 * 60 * 1000).toISOString()}::timestamptz)
      `);

      const events = rows.rows ?? [];
      if (!events.length) return;

      logger.info({ count: events.length }, "[diary-scheduler] Sending upcoming event notifications");

      for (const ev of events) {
        const start = new Date(ev.start_at);
        const minsUntil = Math.round((start.getTime() - now.getTime()) / 60000);
        const timeStr = start.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" });

        const body = ev.location
          ? `${timeStr} · ${ev.location}`
          : `Starting in ~${minsUntil} minutes (${timeStr})`;

        try {
          await sendPushToUsers([ev.user_id], {
            title: `📅 ${ev.title}`,
            body,
            url: "/sky-vision/calendar",
          });

          // Mark as notified
          await db.execute(sql`
            UPDATE sky_diary_events
            SET notified_at = NOW()
            WHERE id = ${ev.id}
          `);
        } catch (err) {
          logger.warn({ err, eventId: ev.id }, "[diary-scheduler] Failed to send notification");
        }
      }
    } catch (err) {
      logger.error({ err }, "[diary-scheduler] Check failed");
    }
  }

  // Run shortly after startup, then on interval
  setTimeout(check, 10_000);
  setInterval(check, INTERVAL_MS);
  logger.info("[diary-scheduler] Started — checking every 5 minutes");
}
