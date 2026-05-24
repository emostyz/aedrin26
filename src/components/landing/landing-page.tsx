'use client'

import Link from 'next/link'

// ─────────────────────────────────────────────────────────────────────────────
// Mock UI — pixel-perfect replicas of the real app (static, no hydration cost)
// ─────────────────────────────────────────────────────────────────────────────

function MockCheckCircle() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="9" fill="currentColor" />
      <path d="M6 10l3 3 5-5" stroke="oklch(0.06 0 0)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function MockEmptyCircle() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden>
      <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.25" style={{ color: 'var(--border)' }} />
    </svg>
  )
}

// The daily prompt card shown in hero — already answered state
function HeroDailyCard() {
  return (
    <div className="border border-border/70 rounded-xl overflow-hidden" style={{ background: 'oklch(0.09 0 0 / 0.8)', backdropFilter: 'blur(12px)' }}>
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="text-foreground"><MockCheckCircle /></span>
        <p className="text-sm font-medium flex-1 text-foreground/50 line-through decoration-foreground/20">Today&apos;s reflection</p>
        <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2.5 py-1 shrink-0">Childhood</span>
      </div>
      <div className="border-t border-border/40" />
      <div className="px-5 py-5 space-y-4">
        <p className="text-base font-light leading-relaxed tracking-[-0.01em] text-foreground/35">
          What do you remember most about the house you grew up in?
        </p>
        <div className="border-l-2 border-foreground/20 pl-4">
          <p className="text-sm text-foreground/70 leading-relaxed font-light">
            We had a small wooden kitchen table where my mother made breakfast every morning, even on the days she must have been exhausted. The sound of the radio. The smell of toast. I can still hear it perfectly.
          </p>
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-1.5 pt-1 border-t border-border/40 text-xs text-muted-foreground">
          <span>More Childhood questions →</span>
          <span>Review all entries →</span>
        </div>
      </div>
    </div>
  )
}

// Idle daily card — for the "how it works" step
function MockIdleDailyCard() {
  return (
    <div className="border border-border rounded-xl overflow-hidden" style={{ background: 'oklch(0.09 0 0 / 0.9)' }}>
      <div className="flex items-center gap-3 px-5 py-4">
        <span className="text-muted-foreground/60"><MockEmptyCircle /></span>
        <p className="text-sm font-medium flex-1">Today&apos;s reflection</p>
        <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2.5 py-1 shrink-0">Career</span>
      </div>
      <div className="border-t border-border/40" />
      <div className="px-5 py-5 space-y-4">
        <p className="text-base font-light leading-relaxed text-foreground">
          What was the moment you knew you were in the right career — or the wrong one?
        </p>
        <div className="flex items-center gap-3">
          <button className="bg-primary text-primary-foreground rounded-md px-4 py-2 text-sm font-medium opacity-90">
            Write your reflection
          </button>
          <span className="text-xs text-muted-foreground">Open in Capture →</span>
        </div>
      </div>
    </div>
  )
}

// Interview session mock
function MockInterviewCard() {
  return (
    <div className="border border-border rounded-xl overflow-hidden" style={{ background: 'oklch(0.09 0 0 / 0.9)' }}>
      <div className="flex border-b border-border overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
        {['Childhood', 'Career', 'Family', 'Values', 'Lessons'].map((d, i) => (
          <button key={d} className={`px-4 py-3 text-xs whitespace-nowrap transition-colors flex-shrink-0 ${
            i === 1 ? 'border-b-2 border-foreground text-foreground' : 'text-muted-foreground'
          }`}>{d}</button>
        ))}
      </div>
      <div className="px-5 py-5 space-y-4">
        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Question 3 of 12</p>
          <p className="text-base font-light leading-relaxed">
            What was the proudest moment of your career — and who witnessed it?
          </p>
        </div>
        <div className="border border-border rounded-lg px-4 py-3 text-sm text-foreground/70 font-light leading-relaxed" style={{ background: 'oklch(1 0 0 / 0.04)' }}>
          It was the day we shipped the product that had nearly broken us. 18 months of work. When we saw the first real users, I stepped into the bathroom and cried. Nobody saw it. But my co-founder knew.
        </div>
        {/* AI follow-up */}
        <div className="border border-border/60 rounded-lg px-4 py-4 space-y-3" style={{ background: 'oklch(1 0 0 / 0.02)' }}>
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">One more thing</p>
            <div className="flex-1 h-px" style={{ background: 'var(--border)' }} />
          </div>
          <p className="text-sm font-light text-foreground/80">
            Why did it feel important to keep that moment private — even from your co-founder?
          </p>
          <div className="flex flex-wrap gap-2">
            {['I needed it for myself', 'Felt too vulnerable', 'Didn\'t want to jinx it', 'Other…'].map((opt) => (
              <span key={opt} className="px-3 py-1 rounded-full border border-border text-xs text-muted-foreground">{opt}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// Life map / timeline mock
function MockLifeMapCard() {
  const events = [
    { year: '1962', title: 'Born in Cork, Ireland', dim: true },
    { year: '1979', title: 'Left home for university in Dublin' },
    { year: '1986', title: 'First job at an architecture firm', accent: false },
    { year: '1993', title: 'Founded my own practice', highlight: true },
    { year: '1997', title: 'Met Sarah at a conference in Paris', highlight: true },
    { year: '2003', title: 'Our son Daniel was born', highlight: true },
    { year: '2019', title: 'Retired to the countryside', dim: true },
  ]
  return (
    <div className="border border-border rounded-xl p-5 space-y-1" style={{ background: 'oklch(0.09 0 0 / 0.9)' }}>
      <div className="flex items-center justify-between mb-4">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Life map</p>
        <span className="text-[10px] text-muted-foreground border border-border rounded-full px-2 py-0.5">7 events</span>
      </div>
      <div className="space-y-0">
        {events.map((e, i) => (
          <div key={i} className="flex gap-4 items-start">
            <span className={`text-[11px] font-mono w-10 shrink-0 pt-1 tabular-nums ${e.dim ? 'text-muted-foreground/30' : 'text-muted-foreground/60'}`}>
              {e.year}
            </span>
            <div className="flex items-start gap-2.5 flex-1 pb-3">
              <div className="flex flex-col items-center mt-1.5 shrink-0">
                <div className={`w-1.5 h-1.5 rounded-full ${e.highlight ? 'bg-foreground' : 'bg-border'}`} />
                {i < events.length - 1 && <div className="w-px bg-border/40 mt-1" style={{ height: 16 }} />}
              </div>
              <p className={`text-sm leading-snug ${e.dim ? 'text-foreground/30' : e.highlight ? 'text-foreground' : 'text-foreground/60'}`}>
                {e.title}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Heirs access mock
function MockHeirsCard() {
  const domains = ['Childhood', 'Family', 'Career', 'Values', 'Lessons', 'Messages']
  const heirs = [
    { name: 'Sarah', rel: 'Wife', active: [0, 1, 2, 3, 4, 5] },
    { name: 'Daniel', rel: 'Son', active: [0, 1, 3, 4] },
    { name: 'Emma', rel: 'Daughter', active: [0, 1, 4, 5] },
  ]
  return (
    <div className="border border-border rounded-xl p-5 space-y-4" style={{ background: 'oklch(0.09 0 0 / 0.9)' }}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">Heirs</p>
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40" />
          <span className="text-[10px] text-muted-foreground/60">Locked until verified</span>
        </div>
      </div>
      <div className="space-y-2.5">
        {heirs.map((heir) => (
          <div key={heir.name} className="border border-border rounded-lg px-4 py-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <p className="text-sm text-foreground">{heir.name}</p>
              <p className="text-xs text-muted-foreground">{heir.rel}</p>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {domains.map((d, i) => (
                <span key={d} className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                  heir.active.includes(i)
                    ? 'border-foreground/20 text-foreground/70 bg-foreground/5'
                    : 'border-border/30 text-muted-foreground/25'
                }`}>{d}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// Voice recorder mock
function MockVoiceCard() {
  return (
    <div className="border border-border rounded-xl p-5 space-y-4" style={{ background: 'oklch(0.09 0 0 / 0.9)' }}>
      <p className="text-base font-light leading-relaxed text-foreground">
        What is the piece of advice you wish someone had given you at 25?
      </p>
      <div className="border border-border rounded-lg px-4 py-3" style={{ background: 'oklch(1 0 0 / 0.04)' }}>
        <p className="text-sm text-foreground/50 font-light italic">Write your response…</p>
      </div>
      {/* Soundwave visual */}
      <div className="border border-border/50 rounded-lg px-4 py-3 flex items-center gap-3" style={{ background: 'oklch(1 0 0 / 0.02)' }}>
        <div className="w-7 h-7 rounded-full border border-border flex items-center justify-center shrink-0">
          <div className="w-2.5 h-2.5 rounded-full bg-foreground/80" />
        </div>
        {/* Fake soundwave bars */}
        <div className="flex items-center gap-0.5 flex-1 h-8">
          {[3,5,8,12,7,10,14,9,6,11,8,5,13,7,4,9,12,6,10,8,5,7,11,9,6,4,8,12,7,5].map((h, i) => (
            <div
              key={i}
              className="flex-1 rounded-full"
              style={{ height: `${h * 2}px`, background: `oklch(1 0 0 / ${0.1 + (h / 14) * 0.3})` }}
            />
          ))}
        </div>
        <span className="text-xs text-muted-foreground font-mono shrink-0">0:00</span>
      </div>
      <p className="text-[11px] text-muted-foreground/50">Tap to record · Transcribed automatically</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Section helpers
// ─────────────────────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-label">{children}</p>
}

function Divider() {
  return <div className="border-t border-border/30" />
}

// ─────────────────────────────────────────────────────────────────────────────
// Nav
// ─────────────────────────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav
      className="sticky top-0 z-50 flex items-center justify-between px-6 py-4"
      style={{ background: 'oklch(0.06 0 0 / 0.85)', backdropFilter: 'blur(16px)', borderBottom: '1px solid oklch(1 0 0 / 0.05)' }}
    >
      <Link href="/" className="text-sm font-medium tracking-[0.12em] text-foreground uppercase">
        AEDRIN
      </Link>
      <div className="flex items-center gap-3">
        <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground transition-colors px-3 py-1.5">
          Sign in
        </Link>
        <Link
          href="/signup"
          className="text-xs font-medium bg-primary text-primary-foreground rounded-lg px-4 py-1.5 hover:opacity-90 transition-opacity"
        >
          Get started →
        </Link>
      </div>
    </nav>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hero
// ─────────────────────────────────────────────────────────────────────────────

function Hero() {
  return (
    <section
      className="relative px-6 pt-20 pb-0 overflow-hidden"
      style={{ minHeight: 'calc(100svh - 57px)' }}
    >
      {/* Ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 50% -5%, oklch(1 0 0 / 0.055) 0%, transparent 65%)' }}
        aria-hidden
      />

      <div className="relative max-w-4xl mx-auto flex flex-col items-center text-center">
        {/* Eyebrow */}
        <div
          className="inline-flex items-center gap-2 mb-8 px-3.5 py-1.5 rounded-full border text-[11px] text-muted-foreground"
          style={{ borderColor: 'oklch(1 0 0 / 0.1)', background: 'oklch(1 0 0 / 0.03)' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-foreground/40 shrink-0" />
          Your story. Preserved. For the people you love.
        </div>

        {/* Headline */}
        <h1
          className="font-light tracking-[-0.04em] leading-[1.05] mb-6"
          style={{ fontSize: 'clamp(2.6rem, 7vw, 5.25rem)' }}
        >
          Some stories are{' '}
          <br className="hidden sm:block" />
          <span className="text-gradient">too important to disappear.</span>
        </h1>

        {/* Sub */}
        <p className="text-base sm:text-lg text-muted-foreground font-light leading-relaxed max-w-xl mb-10">
          AEDRIN captures your memories, wisdom, and voice —
          so the people you love can know you long after you&apos;re gone.
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 mb-16">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl px-8 py-3.5 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Start for free →
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center border border-border rounded-xl px-8 py-3.5 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all"
          >
            Sign in
          </Link>
        </div>

        {/* Hero card — floats over the fold */}
        <div className="w-full max-w-2xl relative">
          {/* Glow beneath card */}
          <div
            className="absolute -inset-6 pointer-events-none"
            style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 80%, oklch(1 0 0 / 0.04) 0%, transparent 70%)' }}
            aria-hidden
          />
          {/* Card */}
          <div className="relative text-left">
            <HeroDailyCard />
          </div>
          {/* Fade bottom edge into next section */}
          <div
            className="absolute bottom-0 left-0 right-0 h-24 pointer-events-none"
            style={{ background: 'linear-gradient(to bottom, transparent, var(--background))' }}
            aria-hidden
          />
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// The problem
// ─────────────────────────────────────────────────────────────────────────────

function Problem() {
  return (
    <section className="px-6 py-24 md:py-32">
      <div className="max-w-3xl mx-auto text-center space-y-8">
        <SectionLabel>The problem</SectionLabel>
        <h2 className="font-light tracking-[-0.03em] leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)' }}>
          What happens to your story<br className="hidden md:block" /> when you&apos;re gone?
        </h2>
        <p className="text-base text-muted-foreground font-light leading-relaxed max-w-2xl mx-auto">
          Your grandchildren will never know your greatest fear. Your proudest moment. The day you almost gave up — but didn&apos;t. The ordinary Wednesday that changed everything.
        </p>
        <p className="text-base text-muted-foreground font-light leading-relaxed max-w-2xl mx-auto">
          Most extraordinary lives leave almost nothing behind. Not because they weren&apos;t worth preserving. Because no one ever asked.
        </p>

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 text-left">
          {[
            {
              stat: '70%',
              label: 'of people wish they knew more about their grandparents\' lives',
            },
            {
              stat: '1 in 3',
              label: 'adults has no record of their own family history beyond two generations',
            },
            {
              stat: '∞',
              label: 'stories lost every day when someone passes without being asked',
            },
          ].map(({ stat, label }) => (
            <div
              key={stat}
              className="border border-border rounded-xl px-5 py-6 space-y-2"
              style={{ background: 'oklch(0.09 0 0 / 0.5)' }}
            >
              <p className="text-3xl font-light tracking-[-0.03em] text-foreground">{stat}</p>
              <p className="text-sm text-muted-foreground font-light leading-relaxed">{label}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// How it works
// ─────────────────────────────────────────────────────────────────────────────

function HowItWorks() {
  return (
    <section className="px-6 py-24 md:py-32" style={{ background: 'oklch(0.08 0 0 / 0.5)' }}>
      <div className="max-w-5xl mx-auto space-y-16">
        <div className="text-center space-y-3">
          <SectionLabel>How it works</SectionLabel>
          <h2 className="font-light tracking-[-0.03em] leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)' }}>
            Simple. Gentle. Permanent.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-6">
          {/* Step 1 */}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-xs text-muted-foreground font-medium shrink-0"
                style={{ background: 'oklch(1 0 0 / 0.04)' }}
              >01</span>
              <div className="flex-1 h-px border-t border-border/40" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-medium tracking-[-0.01em]">One question. Every day.</h3>
              <p className="text-sm text-muted-foreground font-light leading-relaxed">
                A thoughtful question about your life arrives each morning. Write it out — or speak it aloud. Three minutes. Over time, something remarkable accumulates.
              </p>
            </div>
            <MockIdleDailyCard />
          </div>

          {/* Step 2 */}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-xs text-muted-foreground font-medium shrink-0"
                style={{ background: 'oklch(1 0 0 / 0.04)' }}
              >02</span>
              <div className="flex-1 h-px border-t border-border/40" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-medium tracking-[-0.01em]">Go as deep as you want.</h3>
              <p className="text-sm text-muted-foreground font-light leading-relaxed">
                Open Capture and choose a chapter of your life. The AI listens, then asks the follow-up a brilliant friend would ask — the one that gets to the real story.
              </p>
            </div>
            <div className="border border-border rounded-xl p-4 space-y-2" style={{ background: 'oklch(0.09 0 0 / 0.9)' }}>
              <div className="flex gap-1 text-[10px]">
                {['Childhood', 'Career', 'Family'].map((d, i) => (
                  <span key={d} className={`px-2 py-0.5 rounded border ${i === 0 ? 'border-foreground/30 text-foreground' : 'border-border text-muted-foreground'}`}>{d}</span>
                ))}
                <span className="text-muted-foreground/40 px-1">…</span>
              </div>
              <p className="text-sm font-light text-foreground">What was the house you grew up in really like?</p>
              <div className="border border-border/60 rounded p-2.5 space-y-1.5" style={{ background: 'oklch(1 0 0 / 0.02)' }}>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">One more thing</p>
                <p className="text-xs font-light text-foreground/70">Was there a smell or sound that made it feel like home?</p>
              </div>
            </div>
          </div>

          {/* Step 3 */}
          <div className="space-y-5">
            <div className="flex items-center gap-3">
              <span
                className="w-8 h-8 rounded-full border border-border flex items-center justify-center text-xs text-muted-foreground font-medium shrink-0"
                style={{ background: 'oklch(1 0 0 / 0.04)' }}
              >03</span>
              <div className="flex-1 h-px border-t border-border/40" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-medium tracking-[-0.01em]">Your story lives on.</h3>
              <p className="text-sm text-muted-foreground font-light leading-relaxed">
                Designate the people who matter most and choose what each person can read. Nothing is shared until you&apos;re gone — and only exactly what you intended.
              </p>
            </div>
            <div className="border border-border rounded-xl p-4 space-y-3" style={{ background: 'oklch(0.09 0 0 / 0.9)' }}>
              {[
                { name: 'Sarah', rel: 'Wife', access: 'All chapters' },
                { name: 'Daniel', rel: 'Son', access: 'Career · Lessons' },
                { name: 'Emma', rel: 'Daughter', access: 'Family · Messages' },
              ].map((h) => (
                <div key={h.name} className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-[10px] text-muted-foreground" style={{ background: 'oklch(1 0 0 / 0.04)' }}>
                      {h.name[0]}
                    </div>
                    <div>
                      <p className="text-xs text-foreground">{h.name}</p>
                      <p className="text-[10px] text-muted-foreground/60">{h.rel}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-muted-foreground border border-border/50 rounded-full px-2 py-0.5">{h.access}</span>
                </div>
              ))}
              <div className="pt-1 border-t border-border/30">
                <p className="text-[10px] text-muted-foreground/40">Unlocks after verification · Private until then</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Feature sections
// ─────────────────────────────────────────────────────────────────────────────

function FeatureRow({
  label,
  heading,
  body,
  visual,
  flip = false,
}: {
  label: string
  heading: string
  body: string
  visual: React.ReactNode
  flip?: boolean
}) {
  return (
    <div className={`grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16 items-center ${flip ? 'md:[direction:rtl]' : ''}`}>
      <div className={`space-y-5 ${flip ? 'md:[direction:ltr]' : ''}`}>
        <SectionLabel>{label}</SectionLabel>
        <h2 className="font-light tracking-[-0.03em] leading-tight" style={{ fontSize: 'clamp(1.5rem, 3.5vw, 2.25rem)' }}>
          {heading}
        </h2>
        <p className="text-sm text-muted-foreground font-light leading-relaxed">
          {body}
        </p>
      </div>
      <div className={flip ? 'md:[direction:ltr]' : ''}>
        {visual}
      </div>
    </div>
  )
}

function Features() {
  return (
    <section className="px-6 py-24 md:py-32">
      <div className="max-w-5xl mx-auto space-y-24 md:space-y-32">
        <div className="text-center space-y-3">
          <SectionLabel>Features</SectionLabel>
          <h2 className="font-light tracking-[-0.03em] leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)' }}>
            Built for the story of a lifetime.
          </h2>
        </div>

        <FeatureRow
          label="Daily reflection"
          heading="One question. Three minutes. A memory preserved forever."
          body="The hardest part of telling your story is knowing where to start. AEDRIN starts for you — a thoughtful question each day about a chapter of your life. Answer in text, or speak it aloud. Come back tomorrow."
          visual={<MockIdleDailyCard />}
        />

        <Divider />

        <FeatureRow
          flip
          label="Capture sessions"
          heading="Like talking to the best biographer you've ever met."
          body="Pick a domain — childhood, career, family, values. Your personal interviewer listens to what you share, then asks the follow-up that goes deeper. The kind of questions a wise friend would ask. Not a form."
          visual={<MockInterviewCard />}
        />

        <Divider />

        <FeatureRow
          label="Voice capture"
          heading="Words don't always come easily. Your voice does."
          body="Speak your memories aloud and AEDRIN transcribes them. The cadence, the hesitations, the way you tell a story — all of it captured. The words are yours. We just hold them."
          visual={<MockVoiceCard />}
        />

        <Divider />

        <FeatureRow
          flip
          label="Life map"
          heading="The moments that made you who you are, arranged in time."
          body="Key events rise naturally from your answers — births, moves, losses, breakthroughs. AEDRIN extracts them and builds your timeline. A living map of the life you've led, growing richer with every session."
          visual={<MockLifeMapCard />}
        />

        <Divider />

        <FeatureRow
          label="Heirs"
          heading="For the people who deserve to know you."
          body="Choose who receives access to your story and which chapters they can read. Your daughter gets your family memories. Your son gets your lessons. Everything stays completely private until you're gone — and only exactly what you intended reaches each person."
          visual={<MockHeirsCard />}
        />
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Testimonials
// ─────────────────────────────────────────────────────────────────────────────

function Testimonials() {
  const quotes = [
    {
      text: 'My father passed without ever telling us his story. I\'m using AEDRIN so my grandchildren never have to wonder about mine. After four months I have 80 entries — things I\'d forgotten I even remembered.',
      author: 'Robert T.',
      detail: '58 · Civil engineer · Started after his father passed',
    },
    {
      text: 'The follow-up questions are uncanny. I mentioned a moment from my first job almost in passing. The AI asked exactly the right thing, and I ended up writing for an hour. I cried twice.',
      author: 'Dr. Christine L.',
      detail: '63 · Retired surgeon · Has captured over 120 entries',
    },
    {
      text: 'I gave my mother an account for her 70th birthday. She\'s written 94 entries. She told me it\'s the most meaningful thing she\'s ever done. We read them together sometimes.',
      author: 'Sarah M.',
      detail: '41 · Teacher · Gifted AEDRIN to her mother',
    },
  ]

  return (
    <section className="px-6 py-24 md:py-32" style={{ background: 'oklch(0.08 0 0 / 0.4)' }}>
      <div className="max-w-5xl mx-auto space-y-12">
        <div className="text-center space-y-3">
          <SectionLabel>Stories</SectionLabel>
          <h2 className="font-light tracking-[-0.03em] leading-tight" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)' }}>
            From people already writing theirs.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {quotes.map(({ text, author, detail }) => (
            <div
              key={author}
              className="border border-border rounded-xl px-6 py-6 space-y-5 flex flex-col"
              style={{ background: 'oklch(0.09 0 0 / 0.8)' }}
            >
              {/* Quote mark */}
              <svg width="20" height="14" viewBox="0 0 20 14" fill="none" aria-hidden className="text-foreground/20 shrink-0">
                <path d="M0 14V8.4C0 3.733 2.267 1.067 6.8 0l.8 1.4C5.333 1.933 4.267 3 4 4.6H7V14H0Zm11 0V8.4C11 3.733 13.267 1.067 17.8 0l.8 1.4C16.333 1.933 15.267 3 15 4.6H18V14H11Z" fill="currentColor" />
              </svg>
              <p className="text-sm text-foreground/80 font-light leading-relaxed flex-1">{text}</p>
              <div className="pt-3 border-t border-border/40 space-y-0.5">
                <p className="text-xs text-foreground font-medium">{author}</p>
                <p className="text-[11px] text-muted-foreground/60 leading-snug">{detail}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Domains showcase — compact strip
// ─────────────────────────────────────────────────────────────────────────────

function DomainsStrip() {
  const domains = [
    { name: 'Childhood', q: 'What did your childhood bedroom look like?' },
    { name: 'Career', q: 'What\'s the biggest risk you ever took professionally?' },
    { name: 'Family', q: 'What did you learn about love from your parents?' },
    { name: 'Values', q: 'What is the principle you\'d never compromise on?' },
    { name: 'Beliefs', q: 'Has your relationship with faith changed over time?' },
    { name: 'Lessons', q: 'What do you know now that you wish you knew at 30?' },
    { name: 'Messages', q: 'What would you say to your children in a letter?' },
  ]

  return (
    <section className="px-6 py-16 md:py-20">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <SectionLabel>Seven chapters</SectionLabel>
          <p className="text-sm text-muted-foreground font-light">Questions across every dimension of a life.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {domains.map(({ name, q }) => (
            <div
              key={name}
              className="border border-border rounded-lg px-4 py-4 space-y-2 group hover:border-foreground/15 transition-colors"
              style={{ background: 'oklch(0.09 0 0 / 0.5)' }}
            >
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{name}</p>
              <p className="text-xs text-foreground/60 font-light leading-snug group-hover:text-foreground/80 transition-colors">{q}</p>
            </div>
          ))}
          {/* Overflow hint */}
          <div
            className="border border-dashed border-border/40 rounded-lg px-4 py-4 flex items-center justify-center"
          >
            <p className="text-xs text-muted-foreground/40 text-center font-light">Hundreds more<br />questions inside</p>
          </div>
        </div>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Final CTA
// ─────────────────────────────────────────────────────────────────────────────

function FinalCTA() {
  return (
    <section className="px-6 py-24 md:py-40 relative overflow-hidden">
      {/* Glow */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 60% 60% at 50% 50%, oklch(1 0 0 / 0.04) 0%, transparent 70%)' }}
        aria-hidden
      />
      <div className="relative max-w-2xl mx-auto text-center space-y-8">
        <div className="space-y-4">
          <p className="text-label">Start now</p>
          <h2
            className="font-light tracking-[-0.035em] leading-tight"
            style={{ fontSize: 'clamp(2rem, 5.5vw, 3.75rem)' }}
          >
            Start writing your story.<br />
            <span className="text-muted-foreground/50">Before it disappears.</span>
          </h2>
          <p className="text-sm text-muted-foreground font-light leading-relaxed max-w-sm mx-auto">
            Free to begin. No credit card. Three minutes a day.
            Your story, preserved forever.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 bg-primary text-primary-foreground rounded-xl px-10 py-4 text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Get started free →
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center border border-border rounded-xl px-8 py-4 text-sm text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-all"
          >
            Sign in
          </Link>
        </div>

        <p className="text-[11px] text-muted-foreground/40">
          Free forever for personal use · Privacy-first · Your data is yours
        </p>
      </div>
    </section>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Footer
// ─────────────────────────────────────────────────────────────────────────────

function Footer() {
  return (
    <footer className="border-t border-border/30 px-6 py-8">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-xs font-medium tracking-[0.12em] text-muted-foreground/60 uppercase">AEDRIN</p>
        <div className="flex items-center gap-6 text-[11px] text-muted-foreground/40">
          <Link href="/login" className="hover:text-muted-foreground transition-colors">Sign in</Link>
          <Link href="/signup" className="hover:text-muted-foreground transition-colors">Get started</Link>
          <span>An operating system for your soul.</span>
        </div>
      </div>
    </footer>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

export function LandingPage() {
  return (
    <div className="min-h-screen">
      <Nav />
      <Hero />
      <Problem />
      <HowItWorks />
      <Features />
      <DomainsStrip />
      <Testimonials />
      <FinalCTA />
      <Footer />
    </div>
  )
}
