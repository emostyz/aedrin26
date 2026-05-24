// Persistent artifice notice — displayed on every legacy-mode surface.
// §4.3: never removed, never minimized by default.
export default function LegacyLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <div className="bg-muted border-b border-border px-4 py-2.5">
        <p className="text-xs text-muted-foreground text-center max-w-4xl mx-auto">
          You are interacting with an <strong className="font-medium text-foreground">AI representation</strong> built
          from recorded memories and reflections. This is not the person, not a conscious entity, and does not
          have feelings. Responses are grounded in what was recorded — nothing more.
        </p>
      </div>
      <div className="flex-1">
        {children}
      </div>
    </div>
  )
}
