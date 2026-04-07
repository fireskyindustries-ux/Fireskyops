import { Resend } from "resend";
import { logger } from "./logger";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const FROM = "Firesky Industries <info@fireskyindustries.co.za>";

const STAGE_CONFIG: Record<string, { subject: string; headline: string; body: string } | null> = {
  enquiry: {
    subject: "We've received your enquiry — Firesky Industries",
    headline: "Enquiry received",
    body: "Thank you for reaching out. Your enquiry has been logged and our team is reviewing it. Someone will be in touch with you shortly.",
  },
  inspection: {
    subject: "Site inspection scheduled — Firesky Industries",
    headline: "Site inspection in progress",
    body: "Our team is arranging a site inspection to assess your requirements. We will confirm the date and time with you directly.",
  },
  quoting: {
    subject: "Your quote is being prepared — Firesky Industries",
    headline: "Preparing your quote",
    body: "Our team is busy working up a custom quote based on your site requirements. We will have it with you soon.",
  },
  quoted: {
    subject: "Your Firesky quote is ready",
    headline: "Your quote is ready",
    body: "Great news — your custom quote is ready. Our team will be in contact with you shortly to walk you through the details.",
  },
  won: {
    subject: "Installation confirmed — Firesky Industries",
    headline: "Installation confirmed",
    body: "Your installation has been confirmed. Our team will be in touch to finalise scheduling and any last-minute details.",
  },
  delivered: {
    subject: "Your Firesky order has been delivered",
    headline: "All loads delivered",
    body: "All delivery loads for your order have been completed and delivered to site. Thank you for choosing Firesky Industries. Please don't hesitate to reach out if you need anything.",
  },
  lost: null,
  closed: null,
};

function buildEmail(
  customerName: string,
  jobTitle: string,
  stage: string,
  trackingUrl: string | null
): string {
  const config = STAGE_CONFIG[stage];
  if (!config) return "";

  const trackingSection = trackingUrl
    ? `
    <tr>
      <td style="padding: 0 32px 32px;">
        <a href="${trackingUrl}" style="display:inline-block;background:#E85D04;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:4px;font-size:14px;font-weight:600;">
          Track your progress
        </a>
        <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">
          Or copy this link: <a href="${trackingUrl}" style="color:#E85D04;">${trackingUrl}</a>
        </p>
      </td>
    </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;" cellpadding="0" cellspacing="0">

          <!-- Header -->
          <tr>
            <td style="background:#E85D04;padding:24px 32px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Firesky Industries</p>
              <p style="margin:4px 0 0;color:#fde8d8;font-size:13px;">Field Operations</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 16px;font-size:15px;color:#374151;">Hi ${customerName},</p>
              <h2 style="margin:0 0 12px;font-size:22px;color:#111827;font-weight:700;">${config.headline}</h2>
              <p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.6;">${config.body}</p>
              <p style="margin:0;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px;">
                Job reference: <strong style="color:#374151;">${jobTitle}</strong>
              </p>
            </td>
          </tr>

          ${trackingSection}

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                Firesky Industries &nbsp;|&nbsp; info@fireskyindustries.co.za<br>
                You are receiving this email because you have an active job with Firesky Industries.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildQuoteEmail(customerName: string, jobTitle: string, quoteUrl: string, notes: string | null): string {
  const notesSection = notes
    ? `<p style="margin:0 0 20px;font-size:14px;color:#4b5563;line-height:1.6;background:#f9fafb;padding:12px 16px;border-radius:4px;border-left:3px solid #E85D04;">${notes}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:560px;background:#ffffff;border-radius:8px;overflow:hidden;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="background:#E85D04;padding:24px 32px;">
              <p style="margin:0;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Firesky Industries</p>
              <p style="margin:4px 0 0;color:#fde8d8;font-size:13px;">Your Custom Quote</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px 32px 24px;">
              <p style="margin:0 0 16px;font-size:15px;color:#374151;">Hi ${customerName},</p>
              <h2 style="margin:0 0 12px;font-size:22px;color:#111827;font-weight:700;">Your quote is ready</h2>
              <p style="margin:0 0 20px;font-size:15px;color:#4b5563;line-height:1.6;">We have prepared a custom quote for your Firesky installation. Please review it using the link below and let us know if you would like to proceed.</p>
              ${notesSection}
              <p style="margin:0;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px;">
                Reference: <strong style="color:#374151;">${jobTitle}</strong>
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding:0 32px 32px;">
              <a href="${quoteUrl}" style="display:inline-block;background:#E85D04;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:4px;font-size:14px;font-weight:600;">
                View and respond to your quote
              </a>
              <p style="margin:12px 0 0;font-size:12px;color:#9ca3af;">
                Or copy this link: <a href="${quoteUrl}" style="color:#E85D04;">${quoteUrl}</a>
              </p>
            </td>
          </tr>
          <tr>
            <td style="background:#f9fafb;padding:20px 32px;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                Firesky Industries &nbsp;|&nbsp; info@fireskyindustries.co.za<br>
                You are receiving this email because you have an active enquiry with Firesky Industries.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function sendQuoteEmail(params: {
  customerName: string;
  customerEmail: string;
  quoteToken: string;
  jobTitle: string;
  notes: string | null;
}): Promise<void> {
  const { customerName, customerEmail, quoteToken, jobTitle, notes } = params;

  if (!resend) {
    logger.warn("RESEND_API_KEY not set — skipping quote email");
    return;
  }

  const quoteBase =
    process.env.TRACKING_BASE_URL ||
    (process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}/firesky`
      : null);

  if (!quoteBase) {
    logger.warn("No base URL configured — skipping quote email");
    return;
  }

  const quoteUrl = `${quoteBase}/quote/${quoteToken}`;
  const html = buildQuoteEmail(customerName, jobTitle, quoteUrl, notes);

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: customerEmail,
      subject: "Your Firesky quote is ready — please review and respond",
      html,
    });

    if (result.error) {
      logger.error({ err: result.error }, "Resend quote email error");
    } else {
      logger.info({ to: customerEmail, quoteToken }, "Quote email sent");
    }
  } catch (err) {
    logger.error({ err }, "Failed to send quote email");
  }
}

export async function sendJobStageEmail(params: {
  customerName: string;
  customerEmail: string;
  jobTitle: string;
  stage: string;
  customerToken: string | null;
}): Promise<void> {
  const { customerName, customerEmail, jobTitle, stage, customerToken } = params;

  const config = STAGE_CONFIG[stage];
  if (!config) return;

  if (!resend) {
    logger.warn("RESEND_API_KEY not set — skipping job stage email");
    return;
  }

  const trackingBase =
    process.env.TRACKING_BASE_URL ||
    (process.env.REPLIT_DEV_DOMAIN
      ? `https://${process.env.REPLIT_DEV_DOMAIN}/firesky`
      : null);

  const trackingUrl =
    trackingBase && customerToken ? `${trackingBase}/track/${customerToken}` : null;

  const html = buildEmail(customerName, jobTitle, stage, trackingUrl);

  try {
    const result = await resend.emails.send({
      from: FROM,
      to: customerEmail,
      subject: config.subject,
      html,
    });

    if (result.error) {
      logger.error({ err: result.error }, "Resend email error");
    } else {
      logger.info({ to: customerEmail, stage, jobTitle }, "Job stage email sent");
    }
  } catch (err) {
    logger.error({ err }, "Failed to send job stage email");
  }
}
