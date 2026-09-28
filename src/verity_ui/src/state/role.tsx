/**
 * Profile selection.
 *
 * This is a presentation profile, not an authorisation boundary: the API is
 * the same for both, and nothing here should be mistaken for access control.
 * A deployment that needs to actually restrict the investigator surface has
 * to enforce that on the server.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'

export type Role = 'citizen' | 'investigator'

const STORAGE_KEY = 'verity.role'

interface RoleContextValue {
  role: Role | null
  setRole: (role: Role) => void
  clearRole: () => void
}

const RoleContext = createContext<RoleContextValue>({
  role: null,
  setRole: () => undefined,
  clearRole: () => undefined,
})

function readStoredRole(): Role | null {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'citizen' || stored === 'investigator' ? stored : null
  } catch {
    return null
  }
}

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRoleState] = useState<Role | null>(readStoredRole)

  useEffect(() => {
    try {
      if (role) window.localStorage.setItem(STORAGE_KEY, role)
      else window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* private browsing — the choice simply will not persist */
    }
  }, [role])

  const setRole = useCallback((next: Role) => setRoleState(next), [])
  const clearRole = useCallback(() => setRoleState(null), [])

  const value = useMemo(() => ({ role, setRole, clearRole }), [role, setRole, clearRole])
  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>
}

export function useRole(): RoleContextValue {
  return useContext(RoleContext)
}

export const ROLE_LABEL: Record<Role, string> = {
  citizen: 'Citizen',
  investigator: 'Investigator',
}

export const ROLE_HOME: Record<Role, string> = {
  citizen: '/citizen',
  investigator: '/investigator',
}
