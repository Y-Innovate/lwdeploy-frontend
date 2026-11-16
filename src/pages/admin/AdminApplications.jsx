import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { adminApplications, createApplication } from '../../api/admin'
import ErrorBanner from '../../components/ErrorBanner'
import LoadMore from '../../components/LoadMore'
import { usePagedList } from '../../hooks/usePagedList'
import { ADMIN_PATHS, linkTo } from '../../routes'
import ApplicationForm from './ApplicationForm'
import { useAllowlist } from './useAllowlist'

// A1: every application with its groups; a new one
export default function AdminApplications() {
  const list = usePagedList(adminApplications, {})
  const groups = useAllowlist('RACFGRP')
  const [creating, setCreating] = useState(false)
  const navigate = useNavigate()

  async function create(fields) {
    const a = await createApplication(fields)
    navigate(linkTo(ADMIN_PATHS.application, { appID: a.appID }))
  }

  return (
    <>
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-[17px] font-medium">Applications</h1>
        {!creating && (
          <button type="button" className="btn-primary ml-auto" onClick={() => setCreating(true)}>
            <i className="ti ti-plus" aria-hidden="true" />
            New application
          </button>
        )}
      </header>
      {creating && groups.error && <ErrorBanner error={groups.error} onRetry={groups.reload} />}
      {creating && groups.data && (
        <>
          {groups.data.length === 0 && (
            <p className="text-[13px] text-warning-fg">The allowlist of RACF groups is empty: add the groups first.</p>
          )}
          <ApplicationForm groups={groups.data} saveLabel="Create application" onSave={create} onCancel={() => setCreating(false)} />
        </>
      )}
      {list.error && <ErrorBanner error={list.error} onRetry={list.reload} />}
      {!list.loading && !list.error && list.rows.length === 0 && (
        <p className="card p-6 text-fg-2">No applications yet.</p>
      )}
      {list.rows.length > 0 && (
        <div className="card overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr>
                <th>Code</th>
                <th>Name</th>
                <th>Access group</th>
                <th>Owner group</th>
              </tr>
            </thead>
            <tbody>
              {list.rows.map((a) => (
                <tr key={a.appID}>
                  <td>
                    <Link className="font-mono underline" to={linkTo(ADMIN_PATHS.application, { appID: a.appID })}>
                      {a.appCode}
                    </Link>
                  </td>
                  <td>{a.appName}</td>
                  <td className="font-mono">{a.accessGroup}</td>
                  <td className="font-mono">{a.ownerGroup}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <LoadMore list={list} />
    </>
  )
}
