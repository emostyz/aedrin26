'use client'

import { useState, useTransition } from 'react'
import { motion, AnimatePresence } from '@/components/ui/motion'
import { completeOnboarding } from '@/app/actions/onboarding'

type RelStatus = 'single' | 'partnered' | 'married' | 'separated' | 'widowed' | 'other'

const REL_OPTIONS: { value: RelStatus; label: string }[] = [
  { value: 'single',    label: 'Single' },
  { value: 'partnered', label: 'In a relationship' },
  { value: 'married',   label: 'Married' },
  { value: 'separated', label: 'Separated / Divorced' },
  { value: 'widowed',   label: 'Widowed' },
  { value: 'other',     label: 'It\'s complicated' },
]

interface StepData {
  relationship_status: RelStatus | ''
  location: string
  company: string
  job_title: string
  job_happiness: string
  career_goals: string
  family_description: string
  life_description: string
  biggest_regret: string
  life_purpose: string
}

const TOTAL_STEPS = 7

const SLIDE = {
  enter: (dir: number) => ({ opacity: 0, x: dir > 0 ? 40 : -40 }),
  center: { opacity: 1, x: 0 },
  exit: (dir: number) => ({ opacity: 0, x: dir > 0 ? -40 : 40 }),
}

export function OnboardingFlow({ legalName }: { legalName: string }) {
  const firstName = legalName.split(' ')[0]
  const [step, setStep] = useState(0)
  const [dir, setDir]   = useState(1)
  const [data, setData] = useState<StepData>({
    relationship_status: '',
    location: '',
    company: '',
    job_title: '',
    job_happiness: '',
    career_goals: '',
    family_description: '',
    life_description: '',
    biggest_regret: '',
    life_purpose: '',
  })
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function goNext() {
    setDir(1)
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1))
    setError(null)
  }
  function goBack() {
    setDir(-1)
    setStep((s) => Math.max(s - 1, 0))
    setError(null)
  }

  function set<K extends keyof StepData>(key: K, value: StepData[K]) {
    setData((d) => ({ ...d, [key]: value }))
  }

  function handleSubmit() {
    const fd = new FormData()
    if (data.relationship_status) fd.set('relationship_status', data.relationship_status)
    fd.set('location', data.location)
    fd.set('company', data.company)
    fd.set('job_title', data.job_title)
    fd.set('job_happiness', data.job_happiness)
    fd.set('career_goals', data.career_goals)
    fd.set('family_description', data.family_description)
    fd.set('life_description', data.life_description)
    fd.set('biggest_regret', data.biggest_regret)
    fd.set('life_purpose', data.life_purpose)

    startTransition(async () => {
      const result = await completeOnboarding(fd)
      if (result?.error) setError(result.error)
    })
  }

  const steps = [
    // Step 0: Welcome
    <StepWelcome key="welcome" firstName={firstName} onNext={goNext} />,
    // Step 1 of 6: Life stage
    <StepLifeStage
      key="life-stage"
      data={data}
      onChange={set}
      onNext={goNext}
      onBack={goBack}
    />,
    // Step 2 of 6: Work (new)
    <StepWork
      key="work"
      data={data}
      onChange={set}
      onNext={goNext}
      onBack={goBack}
    />,
    // Step 3 of 6: Family (new)
    <StepFamily
      key="family"
      value={data.family_description}
      onChange={(v) => set('family_description', v)}
      onNext={goNext}
      onBack={goBack}
    />,
    // Step 4 of 6: Life description
    <StepLifeDescription
      key="life-desc"
      value={data.life_description}
      onChange={(v) => set('life_description', v)}
      onNext={goNext}
      onBack={goBack}
    />,
    // Step 5 of 6: Biggest regret
    <StepBiggestRegret
      key="regret"
      value={data.biggest_regret}
      onChange={(v) => set('biggest_regret', v)}
      onNext={goNext}
      onBack={goBack}
    />,
    // Step 6 of 6: Life purpose + submit
    <StepLifePurpose
      key="purpose"
      value={data.life_purpose}
      onChange={(v) => set('life_purpose', v)}
      onBack={goBack}
      onSubmit={handleSubmit}
      isPending={isPending}
      error={error}
    />,
  ]

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-[480px]">
        {/* Progress bar */}
        <div className="mb-12">
          <div className="h-px bg-border overflow-hidden rounded-full">
            <motion.div
              className="h-full bg-foreground"
              initial={false}
              animate={{ width: `${((step) / (TOTAL_STEPS - 1)) * 100}%` }}
              transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
            />
          </div>
        </div>

        {/* Step content */}
        <div className="relative overflow-hidden" style={{ minHeight: '60vh' }}>
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={SLIDE}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.38, ease: [0.25, 0.1, 0.25, 1] }}
              className="absolute inset-0"
            >
              {steps[step]}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

// ── Step components ────────────────────────────────────────────────────────────

function StepWelcome({ firstName, onNext }: { firstName: string; onNext: () => void }) {
  return (
    <div className="space-y-10 flex flex-col justify-center h-full pt-8">
      <div className="space-y-3">
        <p className="text-label">AEDRIN</p>
        <h1 className="text-[2.25rem] font-light tracking-[-0.03em] text-foreground leading-[1.15]">
          Welcome,<br />{firstName}.
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
          Before we begin, we&apos;d like to know you a little better.
          The more we understand about your life, the more meaningful your daily
          reflection questions will be.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-sm">
          This takes about two minutes.
        </p>
      </div>
      <button
        onClick={onNext}
        className="inline-flex items-center gap-2 text-sm text-foreground hover:opacity-70 transition-opacity group"
      >
        Begin
        <motion.span
          animate={{ x: [0, 4, 0] }}
          transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
        >→</motion.span>
      </button>
    </div>
  )
}

function StepLifeStage({
  data, onChange, onNext, onBack,
}: {
  data: StepData
  onChange: <K extends keyof StepData>(key: K, value: StepData[K]) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-8 flex flex-col justify-center h-full pt-8">
      <div className="space-y-2">
        <p className="text-label">1 of 6</p>
        <h2 className="text-[1.5rem] font-light tracking-[-0.02em] text-foreground leading-snug">
          Where are you in life right now?
        </h2>
      </div>

      <div className="space-y-6">
        {/* Relationship status */}
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Relationship</p>
          <div className="flex flex-wrap gap-2">
            {REL_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => onChange('relationship_status', opt.value)}
                className={`px-3 py-2 rounded-full text-xs border transition-all duration-200 ${
                  data.relationship_status === opt.value
                    ? 'border-foreground bg-foreground text-background'
                    : 'border-border text-muted-foreground hover:border-foreground/30 hover:text-foreground'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Location */}
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">
            Where do you live?
          </label>
          <input
            type="text"
            value={data.location}
            onChange={(e) => onChange('location', e.target.value)}
            placeholder="City, country…"
            className="w-full bg-input border border-border rounded-md px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
          />
        </div>
      </div>

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  )
}

function StepWork({
  data, onChange, onNext, onBack,
}: {
  data: StepData
  onChange: <K extends keyof StepData>(key: K, value: StepData[K]) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-8 flex flex-col justify-center h-full pt-8">
      <div className="space-y-2">
        <p className="text-label">2 of 6</p>
        <h2 className="text-[1.5rem] font-light tracking-[-0.02em] text-foreground leading-snug">
          Tell us about your work.
        </h2>
      </div>

      <div className="space-y-5">
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">
            Where do you work?
          </label>
          <input
            type="text"
            value={data.company}
            onChange={(e) => onChange('company', e.target.value)}
            placeholder="Company name, or 'Self-employed', 'Retired'…"
            className="w-full bg-input border border-border rounded-md px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">
            What&apos;s your role?
          </label>
          <input
            type="text"
            value={data.job_title}
            onChange={(e) => onChange('job_title', e.target.value)}
            placeholder="Your title or what you actually do…"
            className="w-full bg-input border border-border rounded-md px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">
            How do you feel about your work?
          </label>
          <textarea
            value={data.job_happiness}
            onChange={(e) => onChange('job_happiness', e.target.value)}
            placeholder="Be honest. Do you love it? Tolerate it? Is it a calling or just a job?"
            rows={3}
            className="w-full bg-input border border-border rounded-lg px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none transition-all"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs text-muted-foreground uppercase tracking-wider">
            Where do you want to go?
          </label>
          <textarea
            value={data.career_goals}
            onChange={(e) => onChange('career_goals', e.target.value)}
            placeholder="Long-term — what does success look like for you professionally?"
            rows={3}
            className="w-full bg-input border border-border rounded-lg px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none transition-all"
          />
        </div>
      </div>

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  )
}

function StepFamily({
  value, onChange, onNext, onBack,
}: {
  value: string
  onChange: (v: string) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-8 flex flex-col justify-center h-full pt-8">
      <div className="space-y-2">
        <p className="text-label">3 of 6</p>
        <h2 className="text-[1.5rem] font-light tracking-[-0.02em] text-foreground leading-snug">
          Tell us about your family.
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Who are the people in your life — partners, children, parents, siblings? Tell us who they are, how old they are, whether they&apos;re still with you, and a little about your relationship with each of them.
        </p>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={`My wife Sarah (42) and I have been married for 15 years. We have two kids, Emma (12) and James (9)…\n\nMy father passed away in 2019. My mother Linda (71) lives in Phoenix…`}
        rows={8}
        className="w-full bg-input border border-border rounded-lg px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none transition-all"
      />

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  )
}

function StepLifeDescription({
  value, onChange, onNext, onBack,
}: {
  value: string
  onChange: (v: string) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-8 flex flex-col justify-center h-full pt-8">
      <div className="space-y-2">
        <p className="text-label">4 of 6</p>
        <h2 className="text-[1.5rem] font-light tracking-[-0.02em] text-foreground leading-snug">
          Describe your life in a paragraph.
        </h2>
        <p className="text-sm text-muted-foreground">
          Not your résumé. The texture of it — what it feels like to be you.
        </p>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="I grew up in… My life has mostly been about… What matters most to me is…"
        rows={5}
        className="w-full bg-input border border-border rounded-lg px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none transition-all"
      />

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  )
}

function StepBiggestRegret({
  value, onChange, onNext, onBack,
}: {
  value: string
  onChange: (v: string) => void
  onNext: () => void
  onBack: () => void
}) {
  return (
    <div className="space-y-8 flex flex-col justify-center h-full pt-8">
      <div className="space-y-2">
        <p className="text-label">5 of 6</p>
        <h2 className="text-[1.5rem] font-light tracking-[-0.02em] text-foreground leading-snug">
          What is your biggest regret?
        </h2>
        <p className="text-sm text-muted-foreground">
          You don&apos;t have to resolve it here. Just name it honestly.
          This stays private unless you choose to share it.
        </p>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="I wish I had…"
        rows={4}
        className="w-full bg-input border border-border rounded-lg px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none transition-all"
      />

      <StepNav onBack={onBack} onNext={onNext} />
    </div>
  )
}

function StepLifePurpose({
  value, onChange, onBack, onSubmit, isPending, error,
}: {
  value: string
  onChange: (v: string) => void
  onBack: () => void
  onSubmit: () => void
  isPending: boolean
  error: string | null
}) {
  return (
    <div className="space-y-8 flex flex-col justify-center h-full pt-8">
      <div className="space-y-2">
        <p className="text-label">6 of 6</p>
        <h2 className="text-[1.5rem] font-light tracking-[-0.02em] text-foreground leading-snug">
          What do you believe your life purpose is?
        </h2>
        <p className="text-sm text-muted-foreground">
          Even if you&apos;re still figuring it out — what feels truest right now?
        </p>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="I believe I am here to…"
        rows={4}
        className="w-full bg-input border border-border rounded-lg px-4 py-3.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-none transition-all"
      />

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          ← Back
        </button>
        <button
          onClick={onSubmit}
          disabled={isPending}
          className="bg-primary text-primary-foreground rounded-md px-5 py-2.5 text-sm font-medium hover:opacity-90 disabled:opacity-40 transition-opacity ml-auto"
        >
          {isPending ? 'Preparing your experience…' : 'Begin your journey →'}
        </button>
      </div>
    </div>
  )
}

function StepNav({ onBack, onNext }: { onBack: () => void; onNext: () => void }) {
  return (
    <div className="flex items-center gap-4">
      <button
        onClick={onBack}
        className="text-xs text-muted-foreground hover:text-foreground transition-colors"
      >
        ← Back
      </button>
      <button
        onClick={onNext}
        className="text-xs text-foreground hover:opacity-70 transition-opacity ml-auto"
      >
        Continue →
      </button>
    </div>
  )
}
