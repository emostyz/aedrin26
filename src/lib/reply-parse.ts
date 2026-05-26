// Best-effort extraction of just the user's new text from an email reply,
// dropping quoted history and signatures. Email replies are messy across
// clients, so this is heuristic — it favours keeping the top (new) content.
export function stripQuotedReply(raw: string): string {
  if (!raw) return ''
  const lines = raw.replace(/\r\n/g, '\n').split('\n')
  const kept: string[] = []

  for (const line of lines) {
    // Gmail / Apple Mail attribution line: "On <date>, <name> wrote:"
    if (/^\s*On .+ wrote:\s*$/.test(line)) break
    // Outlook / generic original-message separators
    if (/^\s*-{2,}\s*Original Message\s*-{2,}/i.test(line)) break
    if (/^\s*_{5,}\s*$/.test(line)) break
    // Header block that often precedes a forwarded/quoted message
    if (/^\s*From:\s.+@.+/.test(line) && kept.length > 0) break
    // Quoted lines
    if (/^\s*>/.test(line)) break
    kept.push(line)
  }

  let result = kept.join('\n').trim()
  // Drop a trailing signature delimited by "-- " on its own line
  result = result.replace(/\n-- \n[\s\S]*$/, '').trim()
  // Drop common "Sent from my iPhone"-style trailers
  result = result.replace(/\n+Sent from my .+$/i, '').trim()
  return result
}
