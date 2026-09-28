/**
 * Routing and the two profile shells.
 *
 * Each profile gets its own layout rather than a shared one with hidden
 * sections: the citizen journey is a linear task and the investigator
 * workbench is a navigable console, and forcing them into one information
 * architecture would compromise both.
 */

import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { Activity, Folders, Settings as SettingsIcon, MachineLearning } from '@carbon/icons-react'

import { api } from '@/api/client'
import { usePolling } from '@/api/hooks'
import { AppShell } from '@/components/AppShell'
import type { NavItem } from '@/components/AppShell'
import { useRole } from '@/state/role'

import Landing from '@/routes/Landing'
import CitizenUpload from '@/routes/citizen/Upload'
import CitizenChecking from '@/routes/citizen/Checking'
import CitizenResult from '@/routes/citizen/Result'
import CitizenGuidance from '@/routes/citizen/Guidance'
import InvestigatorCases from '@/routes/investigator/Cases'
import CaseDetail from '@/routes/investigator/CaseDetail'
import Detectors from '@/routes/investigator/Detectors'
import ActivityPage from '@/routes/investigator/Activity'
import Settings from '@/routes/investigator/Settings'

const INVESTIGATOR_NAV: NavItem[] = [
  { label: 'Cases', to: '/investigator', icon: Folders },
  { label: 'Detectors', to: '/investigator/detectors', icon: MachineLearning },
  { label: 'Activity', to: '/investigator/activity', icon: Activity },
  { label: 'Settings', to: '/investigator/settings', icon: SettingsIcon },
]

/** Sends anyone without a chosen profile back to the landing page. */
function RequireRole({ children }: { children: ReactNode }) {
  const { role } = useRole()
  if (!role) return <Navigate to="/" replace />
  return <>{children}</>
}

function CitizenLayout({ children }: { children: ReactNode }) {
  return (
    <RequireRole>
      <AppShell role="citizen">{children}</AppShell>
    </RequireRole>
  )
}

function InvestigatorLayout({ children }: { children: ReactNode }) {
  // Poll only for the header's activity indicator; pages own their own data.
  const { data } = usePolling(() => api.jobs({ limit: 1 }), 6000, true, [])
  return (
    <RequireRole>
      <AppShell role="investigator" nav={INVESTIGATOR_NAV} activeJobs={data?.active ?? 0}>
        {children}
      </AppShell>
    </RequireRole>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />

      {/* ---------------- citizen ---------------- */}
      <Route
        path="/citizen"
        element={
          <CitizenLayout>
            <CitizenUpload />
          </CitizenLayout>
        }
      />
      <Route
        path="/citizen/checking/:mediaId"
        element={
          <CitizenLayout>
            <CitizenChecking />
          </CitizenLayout>
        }
      />
      <Route
        path="/citizen/result/:mediaId"
        element={
          <CitizenLayout>
            <CitizenResult />
          </CitizenLayout>
        }
      />
      <Route
        path="/citizen/guidance/:mediaId"
        element={
          <CitizenLayout>
            <CitizenGuidance />
          </CitizenLayout>
        }
      />
      <Route
        path="/citizen/guidance"
        element={
          <CitizenLayout>
            <CitizenGuidance />
          </CitizenLayout>
        }
      />

      {/* ---------------- investigator ---------------- */}
      <Route
        path="/investigator"
        element={
          <InvestigatorLayout>
            <InvestigatorCases />
          </InvestigatorLayout>
        }
      />
      <Route
        path="/investigator/case/:mediaId"
        element={
          <InvestigatorLayout>
            <CaseDetail />
          </InvestigatorLayout>
        }
      />
      <Route
        path="/investigator/detectors"
        element={
          <InvestigatorLayout>
            <Detectors />
          </InvestigatorLayout>
        }
      />
      <Route
        path="/investigator/activity"
        element={
          <InvestigatorLayout>
            <ActivityPage />
          </InvestigatorLayout>
        }
      />
      <Route
        path="/investigator/settings"
        element={
          <InvestigatorLayout>
            <Settings />
          </InvestigatorLayout>
        }
      />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
