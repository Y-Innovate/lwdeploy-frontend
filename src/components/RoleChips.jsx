import { isYes } from '../lib/codes'

const ROLES = [
  ['isOwner', 'Owner'],
  ['isMember', 'Member'],
  ['isApprover', 'Approver'],
]

// The user's roles in an application (isOwner, isMember, isApprover)
export default function RoleChips({ app }) {
  return (
    <span className="flex flex-wrap gap-1">
      {ROLES.filter(([field]) => isYes(app[field])).map(([field, text]) => (
        <span key={field} className="rounded-full bg-surface-3 px-2 py-0.5 text-[11px] text-fg-2">{text}</span>
      ))}
    </span>
  )
}
