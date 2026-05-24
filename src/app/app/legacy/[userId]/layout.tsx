export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh flex flex-col">
      {/* §4.3 persistent artifice notice — always visible, never removable */}
      <div className="border-b border-border px-6 py-3">
        <p className="text-xs text-muted-foreground text-center max-w-2xl mx-auto leading-relaxed">
          You are speaking with an{' '}
          <span className="text-foreground">AI representation</span>{' '}
          built from recorded memories and reflections — not a conscious being, not the person.
          Responses are drawn only from what was recorded.
        </p>
      </div>
      <div className="flex-1 flex flex-col">{children}</div>
    </div>
  )
}
