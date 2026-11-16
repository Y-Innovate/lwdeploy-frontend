import { useRef } from 'react'
import { jclStats } from '../../lib/jcl'

const RULER = '----+----1----+----2----+----3----+----4----+----5----+----6----+----7--+-----8'.slice(0, 80)

// A monospace textarea with line numbers and an 80-column ruler; guides at
// column 71 (end of a statement) and 80 (end of a card)
export default function JclEditor({ value, onChange, label = 'JCL' }) {
  const gutter = useRef(null)
  const lines = value.split('\n')
  const stats = jclStats(value)

  return (
    <div className="flex flex-col gap-1">
      <div className="overflow-x-auto rounded-md border-[0.5px] border-line-strong font-mono text-[12.5px] leading-[1.6]">
        <div className="flex min-w-max">
          <div className="w-12 shrink-0" />
          <div className="select-none whitespace-pre bg-surface-2 px-2 text-fg-3" aria-hidden="true">{RULER}</div>
        </div>
        <div className="flex min-w-max">
          <div ref={gutter} className="h-[28rem] w-12 shrink-0 overflow-hidden bg-surface-2 py-2 text-right text-fg-3" aria-hidden="true">
            {lines.map((l, i) => (
              <div key={i} className={`pr-2 ${l.length > 80 ? 'bg-danger-bg text-danger-fg' : ''}`}>{i + 1}</div>
            ))}
          </div>
          <textarea
            aria-label={label}
            className="h-[28rem] w-[calc(84ch+1rem)] resize-none bg-surface px-2 py-2 outline-none"
            style={{
              backgroundImage: 'linear-gradient(to right, transparent calc(71ch + 0.5rem), var(--color-line) calc(71ch + 0.5rem), var(--color-line) calc(71ch + 0.5rem + 1px), transparent calc(71ch + 0.5rem + 1px), transparent calc(80ch + 0.5rem), var(--color-line-strong) calc(80ch + 0.5rem), var(--color-line-strong) calc(80ch + 0.5rem + 1px), transparent calc(80ch + 0.5rem + 1px))',
              backgroundAttachment: 'local',
            }}
            wrap="off"
            spellCheck={false}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onScroll={(e) => {
              if (gutter.current) gutter.current.scrollTop = e.target.scrollTop
            }}
          />
        </div>
      </div>
      <p className="text-[12px] text-fg-3" role="status">
        {stats.lines} {stats.lines === 1 ? 'line' : 'lines'} of at most 300
        {stats.over80 > 0 && <span className="text-danger-fg">; {stats.over80} longer than 80 characters</span>}
        {stats.past71 > 0 && <span className="text-warning-fg">; {stats.past71} statements past column 71</span>}
      </p>
    </div>
  )
}
