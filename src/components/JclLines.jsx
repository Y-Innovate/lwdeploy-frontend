// JCL shown read-only with line numbers, whitespace kept
export default function JclLines({ text }) {
  const lines = text ? text.split('\n') : []
  if (!lines.length) return <p className="card p-6 text-fg-2">No JCL yet.</p>
  return (
    <div className="card overflow-x-auto">
      <pre className="py-3 font-mono text-[12.5px] leading-[1.6]">
        {/* Lines never move, so their number is their key */}
        {lines.map((line, i) => (
          <div key={i} className="flex">
            <span className="w-12 shrink-0 select-none pr-3 text-right text-fg-3">{i + 1}</span>
            <span className="whitespace-pre pr-4">{line}</span>
          </div>
        ))}
      </pre>
    </div>
  )
}
