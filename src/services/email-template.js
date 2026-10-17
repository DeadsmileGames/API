import { escapeHtml } from "../utils/html.js";

const COLORS = {
  background: "#0f0f0f",
  panel: "#181818",
  border: "#3d3d3d",
  text: "#f0f0f0",
  muted: "#b8b8b8",
  accent: "#ffffff",
  red: "#ff3b3b",
};

export function brandedEmail({
  preheader = "",
  heading,
  intro = "",
  bodyHtml = "",
  actionLabel = "",
  actionUrl = "",
  footer = "Deadsmile Games · Independent games, made with care.",
}) {
  const safePreheader = escapeHtml(preheader);
  const safeHeading = escapeHtml(heading);
  const safeIntro = escapeHtml(intro);
  const safeActionLabel = escapeHtml(actionLabel);
  const safeActionUrl = escapeHtml(actionUrl);
  const safeFooter = escapeHtml(footer);
  const action = actionLabel && actionUrl
    ? `<tr><td style="padding:8px 0 26px"><a href="${safeActionUrl}" style="display:inline-block;background:${COLORS.accent};color:#0f0f0f;text-decoration:none;font-weight:700;padding:13px 22px;border-radius:8px;font-family:Arial,Helvetica,sans-serif;font-size:14px">${safeActionLabel}</a></td></tr>`
    : "";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"><title>${safeHeading}</title></head><body style="margin:0;padding:0;background:${COLORS.background};color:${COLORS.text};font-family:Poppins,Arial,Helvetica,sans-serif"><div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden">${safePreheader}</div><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${COLORS.background};padding:28px 12px"><tr><td align="center"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;background:${COLORS.panel};border:1px solid ${COLORS.border};border-radius:14px;overflow:hidden"><tr><td style="padding:22px 28px;border-bottom:1px solid ${COLORS.border}"><div style="font-family:Arial,Helvetica,sans-serif;font-size:18px;font-weight:800;letter-spacing:.3px;color:${COLORS.text}">DEADSMILE <span style="color:${COLORS.red}">GAMES</span></div><div style="margin-top:5px;color:${COLORS.muted};font-size:11px;letter-spacing:1.8px;text-transform:uppercase">Independent games studio</div></td></tr><tr><td style="padding:30px 28px 10px"><h1 style="margin:0 0 16px;font-family:Poppins,Arial,Helvetica,sans-serif;font-size:25px;line-height:1.25;color:${COLORS.text}">${safeHeading}</h1>${safeIntro ? `<p style="margin:0 0 18px;color:${COLORS.muted};font-size:15px;line-height:1.75">${safeIntro}</p>` : ""}</td></tr><tr><td style="padding:0 28px 8px;color:${COLORS.text};font-size:14px;line-height:1.8">${bodyHtml}</td></tr>${action ? `<tr><td style="padding:0 28px">${action}</td></tr>` : ""}<tr><td style="padding:20px 28px 24px;border-top:1px solid ${COLORS.border};color:#8c8c8c;font-size:11px;line-height:1.7">${safeFooter}<br>For your security, only use links you expected to receive. If this message wasn't intended for you, you can ignore it.</td></tr></table><div style="max-width:600px;padding:14px 10px;color:#777;font-size:11px;line-height:1.6;text-align:center">This is an automated message from Deadsmile Games. Please do not share security codes or password links.</div></td></tr></table></body></html>`;
}
