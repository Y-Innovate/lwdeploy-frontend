// A choice from an allowlist (rows of { tabKey, tabValue }). A value that
// isn't in the list (any more) stays selectable, marked, so a form never
// changes it unasked. emptyLabel: the text of the empty choice, for an
// optional field.
export default function ListSelect({ label, value, onChange, rows, emptyLabel, required = false, hint }) {
  const missing = value && !rows.some((r) => r.tabKey === value)
  return (
    <div className="flex flex-col gap-1 text-[13px]">
      <label className="flex flex-col gap-1">
        {label}
        <select className="input" value={value} required={required} onChange={(e) => onChange(e.target.value)}>
          {(emptyLabel || !value) && <option value="">{emptyLabel ?? 'Choose…'}</option>}
          {missing && <option value={value}>{value} (not in the allowlist)</option>}
          {rows.map((r) => (
            <option key={r.tabKey} value={r.tabKey}>
              {r.tabValue ? `${r.tabKey} – ${r.tabValue}` : r.tabKey}
            </option>
          ))}
        </select>
      </label>
      {hint && <span className="text-[12px] text-fg-3">{hint}</span>}
    </div>
  )
}
