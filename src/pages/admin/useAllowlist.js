import { refTables } from '../../api/admin'
import { useLoad } from '../../hooks/useLoad'

// One allowlist (RACFGRP or DEPLUSER), all pages, for the choices of a form.
// data: rows of { tabKey, tabValue }.
export function useAllowlist(tableID) {
  return useLoad(() => refTables.listAll({ tableID }), tableID)
}
