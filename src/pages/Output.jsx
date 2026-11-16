import { useCallback, useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { getSpoolText, spoolFiles } from '../api/output'
import ErrorBanner from '../components/ErrorBanner'
import { useLoad } from '../hooks/useLoad'
import { linkTo, PATHS } from '../routes'

// One spool file of a run, part by part (M4):
// /output?runID=106&fileNo=4, with deplID and jobNo for the way back
export default function Output() {
  const [params] = useSearchParams()
  const runID = Number(params.get('runID')) || 0
  const fileNo = Number(params.get('fileNo')) || 0
  const deplID = params.get('deplID')
  const jobNo = params.get('jobNo')
  const files = useLoad(() => spoolFiles.listAll({ runID }), runID, { enabled: runID > 0 })
  const text = useSpoolText(runID, fileNo)

  if (!runID || !fileNo || text.error?.isNotFound) {
    return <p className="card p-6 text-fg-2">This spool file doesn&apos;t exist, or you have no role in its application.</p>
  }
  const file = files.data?.find((f) => f.fileNo === fileNo)
  const back = deplID && jobNo ? linkTo(PATHS.run, { deplID, jobNo, runID }) : null

  return (
    <>
      <header className="flex flex-col gap-1">
        {back && <Link className="text-[13px] text-fg-2 hover:underline" to={back}>Run {runID}</Link>}
        <h1 className="text-[17px] font-medium">
          <span className="font-mono">{file ? `${file.ddName}` : `File ${fileNo}`}</span>
          {file && <span className="ml-2 text-[13px] font-normal text-fg-2">step {file.stepName}, {file.lineCount} lines</span>}
        </h1>
      </header>
      {files.data && files.data.length > 1 && (
        <nav className="flex flex-wrap gap-1" aria-label="Spool files">
          {files.data.map((f) => (
            <Link key={f.fileNo} className={`tab font-mono ${f.fileNo === fileNo ? 'tab-active' : ''}`}
              aria-current={f.fileNo === fileNo ? 'page' : undefined}
              to={linkTo(PATHS.output, { deplID, jobNo, runID, fileNo: f.fileNo })}>
              {f.ddName}
            </Link>
          ))}
        </nav>
      )}
      {text.error && <ErrorBanner error={text.error} onRetry={text.loadMore} />}
      {text.lines.length > 0 && (
        <div className="card overflow-x-auto">
          <pre className="py-3 font-mono text-[12px] leading-[1.55]">
            {/* Lines never move, so their number is their key */}
            {text.lines.map((line, i) => (
              <div key={i} className="flex">
                <span className="w-14 shrink-0 select-none pr-3 text-right text-fg-3">{i + 1}</span>
                <span className="whitespace-pre pr-4">{line}</span>
              </div>
            ))}
          </pre>
        </div>
      )}
      {text.done && text.lines.length === 0 && <p className="card p-6 text-fg-2">This file is empty.</p>}
      {text.more && (
        <div className="flex justify-center">
          <button type="button" className="btn-secondary" disabled={text.loading} onClick={text.loadMore}>
            {text.loading ? 'Loading…' : `Next lines (${text.lines.length} shown${file ? ` of ${file.lineCount}` : ''})`}
          </button>
        </div>
      )}
    </>
  )
}

const EMPTY = { lines: [], next: 0, more: false, done: false, loading: true, error: null }

// The lines read so far, and loadMore() for the next part
function useSpoolText(runID, fileNo) {
  const key = `${runID}/${fileNo}`
  const [state, setState] = useState({ ...EMPTY, key })

  // The first part starts this file's state; later ones are appended, as
  // long as the user is still on the same file
  const fetchPart = useCallback((since) => getSpoolText(runID, fileNo, since).then(
    (part) => setState((s) => (since && s.key !== key ? s : {
      key,
      lines: since ? [...s.lines, ...part.lines] : part.lines,
      next: part.firstLineNum + part.lineCount - 1,
      more: part.moreLines === 'Y',
      done: part.moreLines !== 'Y',
      loading: false,
      error: null,
    })),
    (error) => setState((s) => (since && s.key !== key ? s : { ...(since ? s : EMPTY), key, loading: false, error })),
  ), [runID, fileNo, key])

  useEffect(() => {
    if (runID && fileNo) fetchPart(0)
  }, [fetchPart, runID, fileNo])

  const current = state.key === key ? state : { ...EMPTY, key }
  const loadMore = () => {
    setState((s) => ({ ...s, loading: true }))
    fetchPart(current.next)
  }
  return { ...current, loadMore }
}
