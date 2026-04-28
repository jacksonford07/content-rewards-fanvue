import { useCallback, useEffect, useMemo, useState } from "react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import {
  House,
  FilmSlate,
  ListChecks,
  Wallet,
  MegaphoneSimple,
  Tray,
  ChartBar,
  Bell,
  Sparkle,
  SignOut,
  CaretUpDown,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarMenuBadge,
  useSidebar,
} from "@/components/ui/sidebar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useSidebarHover } from "@/components/app-layout"
import { useAuth } from "@/hooks/use-auth"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { QK } from "@/lib/query-keys"
import { useLogout } from "@/queries/auth"

type UserRole = "clipper" | "creator"

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const logoutMutation = useLogout()
  const { setPopoverOpen } = useSidebarHover()
  const { state, isMobile } = useSidebar()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
  const portalRef = useCallback((node: HTMLDivElement | null) => setPortalContainer(node), [])

  const role: UserRole = user?.role === "creator" ? "creator" : "clipper"

  // Dynamic counts — powered by React Query (cached + invalidated via mutations)
  const { data: mySubCount = 0 } = useQuery({
    queryKey: [QK.submissions.mine, "sidebarCount"] as const,
    queryFn: async () => {
      const r = await api.get("/submissions/mine/stats")
      return (r.data.pending as number) ?? 0
    },
  })
  const { data: inboxCount = 0 } = useQuery({
    queryKey: [QK.submissions.inbox, "sidebarCount"] as const,
    queryFn: async () => {
      const r = await api.get("/submissions/inbox/stats")
      return (r.data.pending as number) ?? 0
    },
  })
  const { data: notifCount = 0 } = useQuery({
    queryKey: [QK.notifications.list, "sidebarCount"] as const,
    queryFn: async () => {
      const r = await api.get("/notifications?page=1&limit=1")
      return (r.data.unreadCount as number) ?? 0
    },
  })
  const counts = { submissions: mySubCount, inbox: inboxCount, notifications: notifCount }

  const clipperNav = useMemo(() => [
    { to: "/", label: "Campaigns hub", icon: House, end: true },
    { to: "/submissions", label: "My submissions", icon: ListChecks, badge: counts.submissions || undefined },
    { to: "/wallet", label: "Wallet & earnings", icon: Wallet },
  ], [counts.submissions])

  const creatorNav = useMemo(() => [
    { to: "/creator/campaigns", label: "My campaigns", icon: MegaphoneSimple },
    { to: "/", label: "Campaigns hub", icon: House, end: true },
    { to: "/creator/inbox", label: "Submission inbox", icon: Tray, badge: counts.inbox || undefined },
    { to: "/creator/analytics", label: "Analytics", icon: ChartBar },
    { to: "/wallet", label: "Wallet", icon: Wallet },
  ], [counts.inbox])

  const bottomNav = useMemo(() => [
    { to: "/notifications", label: "Notifications", icon: Bell, badge: counts.notifications || undefined },
  ], [counts.notifications])

  const mainNav = role === "clipper" ? clipperNav : creatorNav
  const roleLabel = role === "clipper" ? "Clipper" : "Creator"

  const handleDropdownChange = (isOpen: boolean) => {
    setDropdownOpen(isOpen)
    setPopoverOpen(isOpen)
  }

  // Close dropdown when sidebar collapses (desktop only)
  useEffect(() => {
    if (!isMobile && state === "collapsed" && dropdownOpen) {
      setDropdownOpen(false)
      setPopoverOpen(false)
    }
  }, [isMobile, state, dropdownOpen, setPopoverOpen])

  return (
    <Sidebar collapsible="icon" className="border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2 px-2 py-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="relative flex size-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/60 shadow-lg">
            <FilmSlate weight="fill" className="size-4 text-primary-foreground" />
            <span className="absolute -right-0.5 -top-0.5 flex size-2.5 items-center justify-center rounded-full bg-background group-data-[collapsible=icon]:hidden">
              <Sparkle weight="fill" className="size-1.5 text-primary" />
            </span>
          </div>
          <div className="flex flex-col overflow-hidden whitespace-nowrap group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold leading-tight">
              Content Rewards
            </span>
            <span className="text-[11px] text-muted-foreground leading-tight">
              powered by Fanvue
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>{roleLabel}</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainNav.map((item) => {
                const Icon = item.icon
                const end = "end" in item ? (item.end as boolean) : undefined
                const active = end
                  ? location.pathname === item.to
                  : location.pathname.startsWith(item.to)
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                    >
                      <NavLink to={item.to} end={end}>
                        <Icon className="size-5" weight={active ? "fill" : "regular"} />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                    {item.badge && (
                      <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {bottomNav.map((item) => {
                const Icon = item.icon
                const active = location.pathname.startsWith(item.to)
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                    >
                      <NavLink to={item.to}>
                        <Icon className="size-5" weight={active ? "fill" : "regular"} />
                        <span>{item.label}</span>
                      </NavLink>
                    </SidebarMenuButton>
                    {item.badge && (
                      <SidebarMenuBadge>{item.badge}</SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        {isMobile && <div ref={portalRef} />}
        <DropdownMenu open={dropdownOpen} onOpenChange={handleDropdownChange}>
          <DropdownMenuTrigger asChild>
            <button
              className={cn(
                "flex w-full items-center gap-2 rounded-lg p-2 text-left outline-none transition-colors",
                "hover:bg-sidebar-accent",
                "group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-1"
              )}
            >
              <Avatar className="size-7 shrink-0 ring-1 ring-sidebar-border">
                <AvatarImage src={user?.avatarUrl ?? ""} />
                <AvatarFallback>{user?.displayName?.charAt(0) ?? "?"}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-medium truncate">{user?.displayName}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  @{user?.handle}
                </p>
              </div>
              <CaretUpDown className="size-4 shrink-0 text-muted-foreground group-data-[collapsible=icon]:hidden" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            className="w-56"
            container={isMobile ? portalContainer : undefined}
          >
            <DropdownMenuLabel className="font-normal">
              <div className="flex items-center gap-2">
                <Avatar className="size-8 ring-1 ring-border">
                  <AvatarImage src={user?.avatarUrl ?? ""} />
                  <AvatarFallback>{user?.displayName?.charAt(0) ?? "?"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{user?.displayName}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    @{user?.handle}
                  </p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onClick={async () => {
                await logoutMutation.mutateAsync()
                logout()
                toast.success("Signed out")
                navigate("/login")
              }}
            >
              <SignOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
