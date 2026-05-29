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

// ── Daily reflection reminder — prompt + one-click deep link (+ reply-to-save) ─
export function dailyReminderEmail(
  firstName: string,
  promptText: string | null,
  canReply = false,
): { subject: string; html: string } {
  const name = firstName ? esc(firstName) : 'there'
  const promptBlock = promptText
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 22px;"><tr>
         <td style="border-left:2px solid ${C.accent};padding:4px 0 4px 18px;">
           <p style="margin:0;font-size:18px;line-height:1.5;font-weight:300;font-style:italic;color:${C.fg};">&ldquo;${esc(promptText)}&rdquo;</p>
         </td></tr></table>`
    : ''
  const replyHint = canReply
    ? p(`<span style="font-size:12px;color:${C.faint};">Or simply <strong style="color:${C.soft};">reply to this email</strong> with your reflection — we'll save it to your journal automatically.</span>`)
    : p(`<span style="font-size:12px;color:${C.faint};">Tap above and write straight away — it saves to your private journal in one click.</span>`)
  return {
    subject: promptText ? 'Today’s reflection is ready' : 'A moment for yourself today',
    html: shell(
      h1(`A moment for yourself, ${name}.`) +
      p('Two quiet minutes today becomes part of the story the people you love will one day read.') +
      promptBlock +
      button(`${BASE_URL}/app/dashboard?reflect=1`, 'Write today’s reflection') +
      replyHint,
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
// Deep-links directly to the legacy chat page for this specific deceased user
// (not the generic dashboard) so the heir lands exactly where they can start
// asking questions. If they don't have an AEDRIN account yet, the route will
// bounce them through sign-up and back — but the signed-up email must match
// the heir-row email, so we tell them that explicitly here.
export function heirAccessLiveEmail(
  deceasedName: string,
  deceasedUserId: string,
  heirEmail: string,
): { subject: string; html: string } {
  return {
    subject: `You now have access to ${esc(deceasedName)}’s legacy`,
    html: shell(
      h1(`${esc(deceasedName)}’s legacy is now yours to sit with.`) +
      p(`You can now revisit the memories and reflections ${esc(deceasedName)} chose to leave behind — and ask the questions you always wanted to ask. There is no rush. Take all the time you need.`) +
      p(`What you'll find: a private chat where you can ask anything about their life as they remembered it, and any final letters they wrote to you. The AI answers using only what ${esc(deceasedName)} actually recorded — nothing invented.`) +
      button(`${BASE_URL}/app/legacy/${esc(deceasedUserId)}`, 'Open their legacy') +
      p(`<span style="color:${C.faint};font-size:13px;">If you don't have an AEDRIN account yet, sign up with <strong style="color:${C.fg};">${esc(heirEmail)}</strong> — access is tied to that email address.</span>`),
    ),
  }
}

// ── Docs submitted confirmation (to the executor) ────────────────────────────
export function docsSubmittedEmail(
  deceasedName: string,
  graceEndDate: Date,
): { subject: string; html: string } {
  const dateStr = graceEndDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
  return {
    subject: `Documents received — 30-day grace period begins for ${esc(deceasedName)}'s account`,
    html: shell(
      h1('Documents received.') +
      p(`We've received the verification documents for ${esc(deceasedName)}'s account. A mandatory 30-day grace period has begun.`) +
      p(`During this period, the account holder may cancel the request. If no cancellation is received by <strong style="color:${C.fg};">${esc(dateStr)}</strong>, the request will move to human review.`) +
      p('You will be notified when a final decision is made.') +
      button(`${BASE_URL}/app/executor`, 'View request status'),
    ),
  }
}

// ── Grace period expiring warning (to the account owner — 5 days out) ────────
export function graceExpiringEmail(
  deceasedName: string,
  graceEndDate: Date,
): { subject: string; html: string } {
  const dateStr = graceEndDate.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
  return {
    subject: "Your account’s grace period ends soon",
    html: shell(
      h1('You have 5 days to act.') +
      p(`A memorialization request for your account was filed by a designated executor. The 30-day grace period ends on <strong style="color:${C.fg};">${esc(dateStr)}</strong>.`) +
      p(`If this is correct and expected, no action is needed. If this is not what you intended, cancel the request now before the window closes.`) +
      button(`${BASE_URL}/app/settings/memorialization`, 'Review and cancel if needed'),
    ),
  }
}

// ── Grace period expired — admin alert ───────────────────────────────────────
export function graceExpiredAdminEmail(
  deceasedName: string,
  requestId: string,
): { subject: string; html: string } {
  return {
    subject: `[AEDRIN Admin] Memorialization ready for review — ${esc(deceasedName)}`,
    html: shell(
      h1('A memorialization request needs review.') +
      p(`The 30-day grace period for <strong style="color:${C.fg};">${esc(deceasedName)}'s</strong> account has expired without cancellation. The request is now queued for human review.`) +
      p(`Request ID: <code style="font-family:monospace;font-size:13px;color:${C.fg};">${esc(requestId)}</code>`) +
      button(`${BASE_URL}/app/admin/memorialization`, 'Review in admin panel'),
    ),
  }
}

// ── Memorialization approved (to the executor) ────────────────────────────────
export function memorializationApprovedEmail(
  deceasedName: string,
): { subject: string; html: string } {
  return {
    subject: `${esc(deceasedName)}'s account has been memorialized`,
    html: shell(
      h1('The account has been memorialized.') +
      p(`${esc(deceasedName)}'s AEDRIN account is now in legacy mode. The heirs they designated have been notified and now have access to the memories and reflections that were shared with them.`) +
      p('This is a significant moment. Thank you for honoring their wishes.'),
    ),
  }
}

// ── Memorialization rejected (to the executor) ────────────────────────────────
export function memorializationRejectedEmail(
  deceasedName: string,
  notes?: string | null,
): { subject: string; html: string } {
  return {
    subject: `An update on the memorialization request for ${esc(deceasedName)}'s account`,
    html: shell(
      h1('The memorialization request was not approved.') +
      p(`After review, we were unable to approve the memorialization request for ${esc(deceasedName)}'s account.`) +
      (notes ? p(`Reviewer note: <em style="color:${C.fg};">${esc(notes)}</em>`) : '') +
      p('If you believe this was in error, or if you have additional documentation, please contact support.'),
    ),
  }
}

// ── Heir invitation (to a newly designated heir) ──────────────────────────────
export function heirInvitationEmail(
  fromName: string,
  relationship: string,
): { subject: string; html: string } {
  return {
    subject: `${esc(fromName)} has named you in their AEDRIN legacy`,
    html: shell(
      h1(`${esc(fromName)} is thinking of you.`) +
      p(`${esc(fromName)} has designated you as a ${esc(relationship)} in their AEDRIN account — someone they want to have access to their memories, values, and stories after they're gone.`) +
      p('Nothing is visible to you right now — this is simply their way of making sure you are remembered in their legacy plan. You will be notified if and when their account enters legacy mode.') +
      p(`<span style="font-size:13px;color:${C.faint};">If you ever want to capture your own story, AEDRIN is free to join.</span>`) +
      button(`${BASE_URL}/signup`, 'Create your own account'),
    ),
  }
}

// ── Executor invitation (to a newly designated executor) ─────────────────────
export function executorInvitationEmail(
  fromName: string,
): { subject: string; html: string } {
  return {
    subject: `${esc(fromName)} has designated you as an executor on AEDRIN`,
    html: shell(
      h1(`${esc(fromName)} trusts you with something important.`) +
      p(`${esc(fromName)} has named you as an executor in their AEDRIN account. As an executor, you would be the person responsible for initiating the verification process after their passing.`) +
      p('This carries no obligation right now. When the time comes, you would log in to AEDRIN and begin the memorialization process, which includes uploading verification documents and allows the account holder\'s designated heirs to access their legacy.') +
      p(`<span style="font-size:13px;color:${C.faint};">You do not need an AEDRIN account to be an executor, but you may want one.</span>`) +
      button(`${BASE_URL}/app/executor`, 'Learn about your role'),
    ),
  }
}

// ── Welcome email (after onboarding is complete) ─────────────────────────────
export function welcomeEmail(firstName: string): { subject: string; html: string } {
  const name = esc(firstName || 'there')
  return {
    subject: `Welcome to AEDRIN, ${name}`,
    html: shell(
      h1(`Your story starts here, ${name}.`) +
      p('You have taken the first step — and that is the most meaningful one. Everything you capture here is yours: private by default, editable at any time, and exportable whenever you want.') +
      p('The people who know you best will one day want to remember the things you never quite said out loud. This is the place to say them.') +
      p('Begin with whatever is easiest. A memory. A moment. Something you are proud of, or something you wish you had done differently. There is no wrong door into your own story.') +
      button(`${BASE_URL}/app/interview`, 'Start your first memory'),
    ),
  }
}

// ── Weekly digest (sent on a chosen day — context of that week) ──────────────
export function weeklyDigestEmail(
  firstName: string,
  stats: {
    entriesThisWeek: number
    totalEntries: number
    streak: number
    topDomain: string | null
    insightText: string | null
  },
): { subject: string; html: string } {
  const name = esc(firstName || 'there')
  const { entriesThisWeek, totalEntries, streak, topDomain, insightText } = stats

  const statRow = (label: string, value: string | number) =>
    `<tr>
       <td style="padding:8px 0;font-size:13px;color:${C.soft};">${label}</td>
       <td style="padding:8px 0;font-size:13px;color:${C.fg};text-align:right;">${value}</td>
     </tr>`

  const statsTable = `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 24px;border-collapse:collapse;border-top:1px solid ${C.border};">
      ${statRow('Entries this week', entriesThisWeek)}
      ${statRow('Total entries captured', totalEntries)}
      ${streak > 0 ? statRow('Current streak', `${streak} day${streak === 1 ? '' : 's'}`) : ''}
      ${topDomain ? statRow('Most written about', topDomain) : ''}
    </table>`

  const insightBlock = insightText
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;"><tr>
         <td style="border-left:2px solid ${C.accent};padding:4px 0 4px 18px;">
           <p style="margin:0;font-size:15px;line-height:1.6;font-weight:300;font-style:italic;color:${C.fg};">${esc(insightText)}</p>
           <p style="margin:6px 0 0;font-size:11px;color:${C.faint};">This week's insight</p>
         </td></tr></table>`
    : ''

  const closingLine = entriesThisWeek === 0
    ? p('You were quiet this week. That\'s okay. Come back when you\'re ready.')
    : entriesThisWeek < 3
    ? p('A little goes a long way. Everything you capture is a gift to the people who will one day want to know you.')
    : p(`You wrote ${entriesThisWeek} time${entriesThisWeek === 1 ? '' : 's'} this week. The record grows.`)

  return {
    subject: entriesThisWeek > 0
      ? `Your week in AEDRIN — ${entriesThisWeek} entr${entriesThisWeek === 1 ? 'y' : 'ies'} captured`
      : 'Your AEDRIN weekly summary',
    html: shell(
      h1(`This week, ${name}.`) +
      statsTable +
      insightBlock +
      closingLine +
      button(`${BASE_URL}/app/dashboard`, 'Open your journal'),
    ),
  }
}

// ── Milestone email ───────────────────────────────────────────────────────────
export function milestoneEmail(
  firstName: string,
  milestone: '1st_entry' | '10_entries' | '50_entries' | '30_day_streak' | '7_domains',
): { subject: string; html: string } {
  const name = esc(firstName || 'there')
  const copy: Record<string, { subject: string; headline: string; body: string }> = {
    '1st_entry': {
      subject: 'You wrote your first memory',
      headline: 'The first one is the hardest.',
      body: 'You have captured something that will outlast you. Most people never do this. You did.',
    },
    '10_entries': {
      subject: 'Ten memories captured',
      headline: 'Ten entries.',
      body: 'You have captured ten pieces of your story. The picture is starting to take shape. Keep going.',
    },
    '50_entries': {
      subject: 'Fifty entries — your story is real',
      headline: 'Fifty entries.',
      body: 'This is no longer an idea — it is a record. Fifty moments, values, and lessons that belong to you and the people who love you.',
    },
    '30_day_streak': {
      subject: '30 days in a row',
      headline: '30 days without stopping.',
      body: 'Thirty consecutive days of reflection. Whatever you were showing up for — it mattered. The habit is yours now.',
    },
    '7_domains': {
      subject: 'You have written in every domain',
      headline: 'You have touched every part of your story.',
      body: 'Childhood, family, career, values, beliefs, lessons, messages — you have written in all seven domains. Your profile is more complete than most people\'s will ever be.',
    },
  }
  const c = copy[milestone]!
  return {
    subject: c.subject,
    html: shell(
      h1(c.headline) +
      p(c.body) +
      button(`${BASE_URL}/app/dashboard`, 'Continue writing'),
    ),
  }
}

// ── Final letter delivery ─────────────────────────────────────────────────────
// Sent to an heir when their personal letter from the deceased is released.
export function finalLetterEmail(
  fromName: string,
  recipientName: string,
  letterContent: string,
): { subject: string; html: string } {
  const from = esc(fromName)
  const to   = esc(recipientName)
  const body = esc(letterContent)
  return {
    subject: `A letter for you from ${from}`,
    html: shell(
      h1(`A letter for ${to}.`) +
      `<p style="margin:0 0 20px;font-size:12px;line-height:1.6;color:${C.faint};letter-spacing:.05em;text-transform:uppercase;">From ${from}</p>` +
      `<div style="border-left:2px solid ${C.border};padding:0 0 0 20px;margin:0 0 24px;">
        <p style="margin:0;font-size:15px;line-height:1.85;color:${C.soft};white-space:pre-wrap;">${body}</p>
      </div>` +
      `<p style="margin:0;font-size:13px;line-height:1.7;color:${C.faint};">This message was composed by ${from} and kept private in AEDRIN until now. It was written for you.</p>`,
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

// ── Gift invitation (sender → recipient, e.g. child → parent) ─────────────────
// The recipient has never heard of AEDRIN. The email's job is to make this
// feel like a personal request from someone they love, NOT a product pitch.
// The sender's voice comes first. The "what is this" only appears once the
// recipient lands on the claim page.
export function giftInvitationEmail(
  senderName: string,
  recipientName: string,
  relationship: string,
  senderNote: string | null,
  claimUrl: string,
): { subject: string; html: string } {
  const firstName = recipientName.split(/\s+/)[0] || recipientName
  // Relationship-aware framing — "your daughter" reads differently than "your friend".
  const relationshipLine = (() => {
    switch (relationship) {
      case 'parent':      return `${senderName}, your child`
      case 'grandparent': return `${senderName}, your grandchild`
      case 'partner':     return `${senderName}, your partner`
      case 'sibling':     return `${senderName}, your sibling`
      case 'child':       return `${senderName}, your parent`
      case 'friend':      return `${senderName}, your friend`
      default:            return senderName
    }
  })()

  const noteBlock = senderNote
    ? `<blockquote style="margin:0 0 18px;padding:14px 16px;border-left:2px solid ${C.fg};background:${C.bg};color:${C.fg};font-size:15px;line-height:1.65;font-style:italic;">${esc(senderNote)}</blockquote>`
    : ''

  return {
    subject: `${esc(senderName)} would love to know your story`,
    html: shell(
      h1(`A note from ${esc(relationshipLine)}.`) +
      p(`Dear ${esc(firstName)},`) +
      noteBlock +
      p(`${esc(senderName)} set up something for you on AEDRIN — a quiet place where you can share the moments and lessons of your life, one question at a time. There's no pressure, no schedule. You answer when you feel like answering. Even one sentence is enough.`) +
      p(`What you write will be preserved, beautifully, for the people who love you. Some of it will reach them now. Some only later. You decide.`) +
      button(claimUrl, 'See what they wrote') +
      p(`<span style="color:${C.faint};font-size:13px;">This is a private invitation. If you'd rather not, you can simply ignore this email — ${esc(senderName)} won't be notified.</span>`),
    ),
  }
}

// ── Gift claimed (back to the sender, on recipient sign-up) ──────────────────
export function giftClaimedEmail(
  senderFirstName: string,
  recipientName: string,
): { subject: string; html: string } {
  return {
    subject: `${esc(recipientName)} just opened your AEDRIN invitation`,
    html: shell(
      h1(`${esc(recipientName)} said yes.`) +
      p(`Hi ${esc(senderFirstName)} — ${esc(recipientName)} signed up and has started exploring AEDRIN. You'll get a digest of what they share with you as it accumulates. There's no need to do anything right now.`) +
      button(`${BASE_URL}/app/gift`, 'View your gifts'),
    ),
  }
}
