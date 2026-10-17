import { escapeHtml } from "../utils/html.js";

// Keep this fragment aligned with the original newsletter confirmation email.
// Brevo wraps the fragment in its own HTML document and adds tracking markup.
export function brandedEmail({
  heading,
  intro = "",
  bodyHtml = "",
  actionLabel = "",
  actionUrl = "",
  footer = "If you did not request this, you can ignore this message.",
}) {
  const safeHeading = escapeHtml(heading);
  const safeIntro = escapeHtml(intro);
  const safeActionLabel = escapeHtml(actionLabel);
  const safeActionUrl = escapeHtml(actionUrl);
  const safeFooter = escapeHtml(footer);
  const action = actionLabel && actionUrl
    ? `<a href="${safeActionUrl}" style="display:inline-block;background:#f5f1e8;color:#0b0b0b;padding:13px 20px;border-radius:999px;font-weight:700;text-decoration:none;">${safeActionLabel}</a>`
    : "";
  return `<div style="font-family:Arial,sans-serif;background:#0b0b0b;color:#f5f1e8;padding:32px;max-width:560px;margin:auto;border-radius:18px;"><h1 style="font-size:28px;line-height:1.15;margin:0 0 12px;">${safeHeading}</h1>${safeIntro ? `<p style="color:#b9b6af;line-height:1.6;margin:0 0 24px;">${safeIntro}</p>` : ""}${bodyHtml}${action}${safeFooter ? `<p style="color:#6f6d68;font-size:12px;margin:30px 0 0;">${safeFooter}</p>` : ""}</div>`;
}
