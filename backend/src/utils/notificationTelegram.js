import { escapeHtml as esc } from "./email.js";

// Draws one notification (see utils/notify.js for the shape) as a Telegram message:
//   html    for parse_mode "HTML", using only <b>, <i>, <code> and <blockquote>
//   text    the same message without tags, for the retry when Telegram refuses the HTML
//   buttons URL buttons (the main action, then the optional second one)
// `siteUrl` is publicSiteUrl(siteOrigin()). While it is null, the site is not reachable from Telegram
// and the whole message would be refused over a localhost button, so there are no buttons and the
// link is written under the message instead.

const TAGS = /<\/?(?:b|i|code|blockquote)>/g;

function detailRow([label, value, kind]) {
  return `<b>${esc(label)}:</b> ${kind === "code" ? `<code>${esc(value)}</code>` : esc(value)}`;
}

/** The HTML without its tags, with the &#NN; escapes turned back into characters. */
function plainText(html) {
  return html
    .replace(TAGS, "")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)));
}

export function renderTelegram(notification, siteUrl) {
  const { emoji, heading, intro, details, quote, note, action, secondAction } = notification;
  const buttons = siteUrl
    ? [action, secondAction].filter(Boolean).map(({ label, link }) => [{ text: label, url: link }])
    : [];

  const html = [
    `${emoji} <b>${esc(heading)}</b>\n${esc(intro)}`,
    details?.length && details.map(detailRow).join("\n"),
    quote && `<blockquote>${esc(quote)}</blockquote>`,
    note && `<i>${esc(note)}</i>`,
    !buttons.length && `${esc(action.label)}: ${esc(action.link)}`,
  ].filter(Boolean).join("\n\n");

  const linkLine = buttons.length ? `\n\n${action.label}: ${action.link}` : "";
  return { html, text: plainText(html) + linkLine, buttons };
}
