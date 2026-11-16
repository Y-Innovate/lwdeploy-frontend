import { Route, Routes } from 'react-router'
import NotFound from '../NotFound'
import AdminApplication from './AdminApplication'
import AdminApplications from './AdminApplications'
import AdminDeployments from './AdminDeployments'
import AdminLayout from './AdminLayout'
import Allowlists from './Allowlists'
import Settings from './Settings'

// The administrators' pages under /lwdeploy/admin (PLAN-ADMIN.md). App.jsx
// loads this module lazily, so everything it imports goes into one chunk
// that other users never download. Paths: ADMIN_PATHS in src/routes.js.
export default function AdminApp() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route index element={<AdminApplications />} />
        <Route path="app" element={<AdminApplication />} />
        <Route path="deployments" element={<AdminDeployments />} />
        <Route path="lists" element={<Allowlists />} />
        <Route path="settings" element={<Settings />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
