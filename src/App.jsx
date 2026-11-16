import { lazy } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router'
import AdminRoute from './components/AdminRoute'
import Layout from './components/Layout'
import SessionRoute from './components/SessionRoute'
import { SessionProvider } from './context/SessionContext'
import AppPage from './pages/AppPage'
import Approvals from './pages/Approvals'
import Deploy from './pages/Deploy'
import Deployment from './pages/Deployment'
import Home from './pages/Home'
import Jcl from './pages/Jcl'
import Login from './pages/Login'
import NotFound from './pages/NotFound'
import Output from './pages/Output'
import Profile from './pages/Profile'
import Run from './pages/Run'
import Template from './pages/Template'

// The administrators' pages, in a chunk of their own that loads on first use
const AdminApp = lazy(() => import('./pages/admin/AdminApp'))

// Paths: src/routes.js; screens: PLAN.md and PLAN-ADMIN.md.
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="login" element={<Login />} />
        <Route element={<SessionRoute />}>
          <Route index element={<Home />} />
          <Route path="app" element={<AppPage />} />
          <Route path="template" element={<Template />} />
          <Route path="deploy" element={<Deploy />} />
          <Route path="deployment" element={<Deployment />} />
          <Route path="jcl" element={<Jcl />} />
          <Route path="run" element={<Run />} />
          <Route path="output" element={<Output />} />
          <Route path="approvals" element={<Approvals />} />
          <Route path="profile" element={<Profile />} />
          <Route element={<AdminRoute />}>
            <Route path="admin/*" element={<AdminApp />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter basename="/lwdeploy">
      <SessionProvider>
        <AppRoutes />
      </SessionProvider>
    </BrowserRouter>
  )
}
