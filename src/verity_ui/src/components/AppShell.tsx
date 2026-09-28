/**
 * Carbon UI Shell, configured per profile.
 *
 * The citizen shell is intentionally almost chromeless — one task at a time,
 * no navigation to get lost in. The investigator shell carries the full
 * workbench navigation plus an activity indicator, because running jobs are
 * the thing most likely to need attention mid-session.
 */

import type { ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import {
  Content,
  Header,
  HeaderGlobalAction,
  HeaderGlobalBar,
  HeaderMenuButton,
  HeaderName,
  HeaderNavigation,
  HeaderMenuItem,
  SideNav,
  SideNavItems,
  SideNavLink,
  SkipToContent,
  Theme,
} from '@carbon/react'
import { Events, Repeat, UserAvatar } from '@carbon/icons-react'
import type { CarbonIconType } from '@carbon/icons-react'

import { ROLE_LABEL, useRole } from '@/state/role'
import type { Role } from '@/state/role'

export interface NavItem {
  label: string
  to: string
  icon?: CarbonIconType
}

function RoleSwitcher() {
  const { role, clearRole } = useRole()
  const navigate = useNavigate()

  return (
    <>
      <span className="vy-role-chip" style={{ marginInlineEnd: '0.5rem' }}>
        <UserAvatar size={16} />
        {role ? ROLE_LABEL[role] : 'No profile'}
      </span>
      <HeaderGlobalAction
        aria-label="Switch profile"
        tooltipAlignment="end"
        onClick={() => {
          clearRole()
          navigate('/')
        }}
      >
        <Repeat size={20} />
      </HeaderGlobalAction>
    </>
  )
}

export function AppShell({
  role,
  nav = [],
  activeJobs = 0,
  children,
}: {
  role: Role
  nav?: NavItem[]
  activeJobs?: number
  children: ReactNode
}) {
  const location = useLocation()
  const theme = role === 'investigator' ? 'g100' : 'white'
  const headerTheme = 'g100'

  const isActive = (to: string) =>
    to === location.pathname || (to !== '/investigator' && location.pathname.startsWith(to))

  return (
    <Theme theme={theme}>
      <div className="vy-app">
        <Theme theme={headerTheme}>
          <Header aria-label="Verity">
            <SkipToContent />
            {nav.length ? (
              <HeaderMenuButton aria-label="Open menu" isCollapsible onClick={() => undefined} />
            ) : null}
            <HeaderName as={Link} to={role === 'citizen' ? '/citizen' : '/investigator'} prefix="">
              Verity
              <span className="vy-header__product">
                {role === 'citizen' ? 'Check a file' : 'Investigation console'}
              </span>
            </HeaderName>

            {nav.length ? (
              <HeaderNavigation aria-label="Verity sections">
                {nav.map((item) => (
                  <HeaderMenuItem
                    as={Link}
                    to={item.to}
                    key={item.to}
                    isActive={isActive(item.to)}
                  >
                    {item.label}
                  </HeaderMenuItem>
                ))}
              </HeaderNavigation>
            ) : null}

            <HeaderGlobalBar>
              {activeJobs > 0 ? (
                <HeaderGlobalAction
                  aria-label={`${activeJobs} job${activeJobs === 1 ? '' : 's'} running`}
                  tooltipAlignment="end"
                  onClick={() => undefined}
                >
                  <Events size={20} />
                </HeaderGlobalAction>
              ) : null}
              <RoleSwitcher />
            </HeaderGlobalBar>

            {nav.length ? (
              <SideNav aria-label="Side navigation" isRail expanded={false}>
                <SideNavItems>
                  {nav.map((item) => (
                    <SideNavLink
                      as={Link}
                      to={item.to}
                      key={item.to}
                      renderIcon={item.icon}
                      isActive={isActive(item.to)}
                    >
                      {item.label}
                    </SideNavLink>
                  ))}
                </SideNavItems>
              </SideNav>
            ) : null}
          </Header>
        </Theme>

        <Content id="main-content" className="vy-shell-content">
          {children}
        </Content>
      </div>
    </Theme>
  )
}
