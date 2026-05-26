// On-brand HTML email templates — AEDRIN's dark, minimal aesthetic.
// Inline styles only (clients strip <style>); explicit bgcolor for dark shells.

const BASE_URL = process.env.BASE_URL || 'https://www.aedrin.com'

const C = {
  bg: '#0a0a0a',
  card: '#121211',
  border: 'rgba(255,255,255,0.10)',
  fg: '#fafaf9',
  soft: '#a8a29e',
  faint: '#57534e',
  accent: 'rgba(255,255,255,0.18)',
}

function shell(inner: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:${C.bg};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${C.bg}" style="background:${C.bg};">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:460px;background:${C.card};border:1px solid ${C.border};border-radius:16px;">
        <tr><td style="padding:32px 36px 4px;">
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:12px;letter-spacing:.22em;text-transform:uppercase;color:${C.fg};font-weight:600;">AEDRIN</p>
        </td></tr>
        <tr><td style="padding:20px 36px 32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">${inner}</td></tr>
        <tr><td style="padding:18px 36px;border-top:1px solid ${C.border};">
          <p style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:11px;line-height:1.7;color:${C.faint};">An operating system for your soul.<br/>You're receiving this because you have an AEDRIN account. <a href="${BASE_URL}/app/settings" style="color:${C.soft};text-decoration:underline;">Manage notifications</a>.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`
}

function h1(text: string): string {
  return `<h1 style="margin:0 0 14px;font-size:24px;font-weight:300;letter-spacing:-.02em;line-height:1.25;color:${C.fg};">${text}</h1>`
}
function p(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.7;color:${C.soft};">${text}</p>`
}
function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 4px;"><tr><td style="border-radius:9px;background:${C.fg};">
    <a href="${href}" style="display:inline-block;padding:12px 26px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;font-size:14px;font-weight:500;color:${C.bg};text-decoration:none;border-radius:9px;">${label}</a>
  </td></tr></table>`
}
function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Daily reflection reminder — features the prompt + one-click deep link ────
export function dailyReminderEmail(firstName: string, promptText: string | null): { subject: string; html: string } {
  const name = firstName ? esc(firstName) : 'there'
  const promptBlock = promptText
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;"><tr>
         <td style="border-left:2px solid ${C.accent};padding:4px 0 4px 18px;">
           <p style="margin:0;font-size:18px;line-height:1.5;font-weight:300;font-style:italic;color:${C.fg};">&ldquo;${esc(promptText)}&rdquo;</p>
         </td></tr></table>`
    : ''
  // Deep link lands them with the answer composer already open (?reflect=1).
  return {
    subject: promptText ? 'Today’s reflection is ready' : 'A moment for yourself today',
    html: shell(
      h1(`A moment for yourself, ${name}.`) +
      p('Two quiet minutes today becomes part of the story the people you love will one day read.') +
      promptBlock +
      button(`${BASE_URL}/app/dashboard?reflect=1`, 'Write today’s reflection') +
      p(`<span style="font-size:12px;color:${C.faint};">Tap above and write straight away — it saves to your private journal in one click.</span>`),
    ),
  }
}

// ── Memorialization initiated (to the account owner — safety/cancel) ─────────
export function memorializationInitiatedEmail(): { subject: string; html: string } {
  return {
    subject: 'A memorialization request was started on your account',
    html: shell(
      h1('Someone has started a memorialization request.') +
      p('An executor you designated has begun the process to memorialize your AEDRIN account. If this is expected, no action is needed.') +
      p('<strong style="color:' + C.fg + ';">If this was a mistake</strong>, you can cancel it during the grace period.') +
      button(`${BASE_URL}/app/settings/memorialization`, 'Review the request'),
    ),
  }
}

// ── Heir access is live (to each heir, on approval) ──────────────────────────
export function heirAccessLiveEmail(deceasedName: string): { subject: string; html: string } {
  return {
    subject: `You now have access to ${esc(deceasedName)}’s legacy`,
    html: shell(
      h1(`${esc(deceasedName)}’s legacy is now yours to sit with.`) +
      p(`You can now revisit the memories and reflections ${esc(deceasedName)} chose to leave behind — and ask the questions you always wanted to ask. There is no rush. Take all the time you need.`) +
      button(`${BASE_URL}/app/dashboard`, 'Open their legacy'),
    ),
  }
}

// ── Representative access request decision (to the requester) ────────────────
export function accessDecisionEmail(approved: boolean, escalated: boolean): { subject: string; html: string } {
  if (approved) {
    return {
      subject: 'Your access request was approved',
      html: shell(
        h1('Your request has been approved.') +
        p('Your authorization has been verified. Your access is scoped to what was shared with you, time-limited, and logged.') +
        button(`${BASE_URL}/app/represent`, 'View your access'),
      ),
    }
  }
  if (escalated) {
    return {
      subject: 'Your access request is under review',
      html: shell(
        h1('Your request is being reviewed.') +
        p('Thank you for your patience. A person will review your request and the documents you provided, and you’ll hear from us once a decision is made.'),
      ),
    }
  }
  return {
    subject: 'An update on your access request',
    html: shell(
      h1('An update on your request.') +
      p('Your access request was not approved. If you believe this is an error, you may submit a new request with additional context.') +
      button(`${BASE_URL}/app/represent`, 'View your requests'),
    ),
  }
}
