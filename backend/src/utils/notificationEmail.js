import { escapeHtml as esc } from "./email.js";

// Draws one notification (see utils/notify.js for the shape) as an email: { text, html }.
// The HTML is one 560px column of tables with inline styles, because Outlook on Windows ignores most
// modern CSS. It has no images and no web fonts, so nothing can arrive blocked or broken, and every
// text and background colour is written out so a mail app that inverts colours keeps it readable.

const FONT = "-apple-system, 'Segoe UI', Helvetica, Arial, sans-serif";
const MONO = "ui-monospace, Menlo, Consolas, monospace";
const PAGE = "#e6f2dd";
const GREEN = "#1b3022"; // header band
const BUTTON = "#1e4d38"; // white text on it is above 9:1
const TEXT = "#1a1f1c";
const MUTED = "#4a5850"; // at least 4.5:1 on white and on the page colour
const LINE = "#d5dfd0";
const FOOTER = "You are getting this email because you have a UniSwap account.";

const paragraph = (html, style = "") =>
  `<p style="margin:0 0 16px;font-size:16px;line-height:24px;color:${TEXT};${style}">${html}</p>`;

function detailsTable(details) {
  const rows = details.map(([label, value, kind]) => {
    const shown = kind === "code" ? `<span style="font-family:${MONO};">${esc(value)}</span>` : esc(value);
    return `<tr>
<td valign="top" style="padding:10px 12px 10px 0;border-top:1px solid ${LINE};font-size:14px;line-height:20px;color:${MUTED};">${esc(label)}</td>
<td valign="top" style="padding:10px 0;border-top:1px solid ${LINE};font-size:15px;line-height:20px;font-weight:bold;color:${TEXT};">${shown}</td>
</tr>`;
  });
  return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
${rows.join("\n")}
</table>`;
}

function quoteBlock(quote) {
  return `<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 20px;">
<tr><td bgcolor="#eef4ea" style="background-color:#eef4ea;border-left:4px solid ${BUTTON};padding:14px 16px;font-size:16px;line-height:24px;color:${TEXT};">${esc(quote)}</td></tr>
</table>`;
}

function button({ label, link }) {
  return `<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:8px 0 24px;">
<tr><td bgcolor="${BUTTON}" style="background-color:${BUTTON};border-radius:8px;">
<a href="${esc(link)}" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;line-height:20px;font-weight:bold;color:#ffffff;text-decoration:none;">${esc(label)}</a>
</td></tr>
</table>`;
}

function renderHtml(n, name) {
  const body = [
    name && paragraph(`Hi ${esc(name)},`, "margin-bottom:12px;color:" + MUTED + ";"),
    `<h1 style="margin:0 0 12px;font-size:22px;line-height:28px;font-weight:bold;color:${TEXT};">${n.emoji ? `${n.emoji} ` : ""}${esc(n.heading)}</h1>`,
    paragraph(esc(n.intro)),
    n.details?.length && detailsTable(n.details),
    n.quote && quoteBlock(n.quote),
    button(n.action),
    n.note && paragraph(esc(n.note), `font-size:14px;line-height:20px;color:${MUTED};margin-bottom:0;`),
  ].filter(Boolean).join("\n");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<meta name="supported-color-schemes" content="light">
<title>${esc(n.subject)}</title>
</head>
<body bgcolor="${PAGE}" style="margin:0;padding:0;background-color:${PAGE};font-family:${FONT};">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${PAGE};opacity:0;">${esc(n.preheader ?? n.intro)}</div>
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="${PAGE}" style="background-color:${PAGE};">
<tr><td align="center" style="padding:24px 16px;">
<table role="presentation" width="560" border="0" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;">
<tr><td bgcolor="${GREEN}" style="background-color:${GREEN};border-radius:12px 12px 0 0;padding:18px 24px;font-family:${FONT};font-size:20px;line-height:24px;font-weight:bold;color:#ffffff;">UniSwap</td></tr>
<tr><td bgcolor="#ffffff" style="background-color:#ffffff;border-radius:0 0 12px 12px;padding:28px 24px;font-family:${FONT};color:${TEXT};">
${body}
</td></tr>
<tr><td align="center" style="padding:16px 8px 0;font-family:${FONT};font-size:12px;line-height:18px;color:${MUTED};">${FOOTER}</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}

function renderText(n, name) {
  return [
    name && `Hi ${name},`,
    `${n.heading}\n${n.intro}`,
    n.details?.length && n.details.map(([label, value]) => `${label}: ${value}`).join("\n"),
    n.quote && `"${n.quote}"`,
    `${n.action.label}: ${n.action.link}`,
    n.note,
    `--\n${FOOTER}`,
  ].filter(Boolean).join("\n\n");
}

/** `name` is the person it is sent to; it starts the message with "Hi <name>,". */
export function renderEmail(notification, name) {
  return { text: renderText(notification, name), html: renderHtml(notification, name) };
}
