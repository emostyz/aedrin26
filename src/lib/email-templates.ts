// Plain, warm HTML email templates. Light theme (emails read better light),
// inline styles only (email clients strip <style>). One shared shell.

const BASE_URL = process.env.BASE_URL || 'https://www.aedrin.com'

function shell(bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f5f5f4;padding:32px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1c1917;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid #e7e5e4;">
      <tr><td style="padding:28px 32px 8px;">
        <p style="margin:0;font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:#78716c;font-weight:600;">AEDRIN</p>
      </td></tr>
      <tr><td style="padding:8px 32px 28px;">${bodyHtml}</td></tr>
      <tr><td style="padding:18px 32px;border-top:1px solid #f0efee;">
        <p style="margin:0;font-size:11px;color:#a8a29e;line-height:1.6;">An operating system for your soul. You're receiving this because you have an AEDRIN account.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;background:#1c1917;color:#ffffff;text-decoration:none;font-size:14px;font-weight:500;padding:11px 22px;border-radius:8px;">${label}</a>`
}

function heading(text: string): string {
  return `<h1 style="margin:0 0 12px;font-size:22px;font-weight:400;letter-spacing:-.02em;line-height:1.25;color:#1c1917;">${text}</h1>`
}
function para(text: string): string {
  return `<p style="margin:0 0 16px;font-size:15px;line-height:1.65;color:#44403c;">${text}</p>`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// ── Daily reflection reminder ────────────────────────────────────────────────
export function dailyReminderEmail(firstName: string, promptText: string | null): { subject: string; html: string } {
  const name = firstName ? esc(firstName) : 'there'
  const prompt = promptText
    ? para(`Today's question:<br><span style="color:#1c1917;font-style:italic;">&ldquo;${esc(promptText)}&rdquo;</span>`)
    : ''
  return {
    subject: 'Your reflection is waiting',
    html: shell(
      heading(`A moment for yourself, ${name}.`) +
      para('Your story is written one day at a time. Two minutes today is a gift to the people who will read this someday.') +
      prompt +
      `<div style="margin-top:8px;">${button(`${BASE_URL}/app/dashboard`, 'Reflect now')}</div>`,
    ),
  }
}

// ── Memorialization initiated (to the account owner — safety/cancel) ─────────
export function memorializationInitiatedEmail(): { subject: string; html: string } {
  return {
    subject: 'A memorialization request was started on your account',
    html: shell(
      heading('Someone has started a memorialization request.') +
      para('An executor you designated has begun the process to memorialize your AEDRIN account. If this is expected, no action is needed.') +
      para('<strong>If this was a mistake</strong>, you can cancel it during the grace period.') +
      `<div style="margin-top:8px;">${button(`${BASE_URL}/app/settings/memorialization`, 'Review the request')}</div>`,
    ),
  }
}

// ── Heir access is live (to each heir, on approval) ──────────────────────────
export function heirAccessLiveEmail(deceasedName: string): { subject: string; html: string } {
  return {
    subject: `You now have access to ${esc(deceasedName)}'s legacy`,
    html: shell(
      heading(`${esc(deceasedName)}'s legacy is now available to you.`) +
      para(`You can now sit with the memories and reflections ${esc(deceasedName)} chose to leave behind, and ask the questions you always wanted to ask. Take your time.`) +
      `<div style="margin-top:8px;">${button(`${BASE_URL}/app/dashboard`, 'Open their legacy')}</div>`,
    ),
  }
}

// ── Representative access request decision (to the requester) ────────────────
export function accessDecisionEmail(approved: boolean, escalated: boolean): { subject: string; html: string } {
  if (approved) {
    return {
      subject: 'Your access request was approved',
      html: shell(
        heading('Your request has been approved.') +
        para('Your authorization has been verified. Your access is scoped to what was shared with you and is time-limited and logged.') +
        `<div style="margin-top:8px;">${button(`${BASE_URL}/app/represent`, 'View your access')}</div>`,
      ),
    }
  }
  if (escalated) {
    return {
      subject: 'Your access request is under review',
      html: shell(
        heading('Your request is being reviewed.') +
        para('Thank you for your patience. A person will review your request and the documents you provided. You\'ll hear from us once a decision is made.'),
      ),
    }
  }
  return {
    subject: 'An update on your access request',
    html: shell(
      heading('An update on your request.') +
      para('Your access request was not approved. If you believe this is an error, you may submit a new request with additional context.') +
      `<div style="margin-top:8px;">${button(`${BASE_URL}/app/represent`, 'View your requests')}</div>`,
    ),
  }
}
