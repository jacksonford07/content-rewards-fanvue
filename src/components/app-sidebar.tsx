import { useCallback, useEffect, useState } from "react"
import { NavLink, useLocation, useNavigate } from "react-router-dom"
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
  User,
  Gear,
  ArrowsClockwise,
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
import { currentUser } from "@/lib/mock-data"
import { cn } from "@/lib/utils"

type UserRole = "clipper" | "creator"

const clipperNav = [
  { to: "/", label: "Campaigns hub", icon: House, end: true },
  { to: "/submissions", label: "My submissions", icon: ListChecks, badge: "3" },
  { to: "/wallet", label: "Wallet & earnings", icon: Wallet },
]

const creatorNav = [
  {
    to: "/creator/campaigns",
    label: "My campaigns",
    icon: MegaphoneSimple,
  },
  {
    to: "/creator/inbox",
    label: "Submission inbox",
    icon: Tray,
    badge: "2",
  },
  { to: "/creator/analytics", label: "Analytics", icon: ChartBar },
]

const bottomNav = [
  { to: "/notifications", label: "Notifications", icon: Bell, badge: "4" },
]

export function AppSidebar() {
  const location = useLocation()
  const navigate = useNavigate()
  const { setPopoverOpen } = useSidebarHover()
  const { state, isMobile } = useSidebar()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null)
  const portalRef = useCallback((node: HTMLDivElement | null) => setPortalContainer(node), [])

  const [role, setRole] = useState<UserRole>(() => {
    return (localStorage.getItem("cr_role") as UserRole) || "clipper"
  })

  const switchRole = () => {
    const newRole: UserRole = role === "clipper" ? "creator" : "clipper"
    setRole(newRole)
    localStorage.setItem("cr_role", newRole)
    toast.success(`Switched to ${newRole === "clipper" ? "Clipper" : "Creator"} mode`)
    navigate(newRole === "clipper" ? "/" : "/creator/campaigns")
  }

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
                      tooltip={item.label}
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
              <SidebarMenuItem>
                <SidebarMenuButton onClick={switchRole} tooltip={`Switch to ${role === "clipper" ? "Creator" : "Clipper"}`}>
                  <ArrowsClockwise className="size-5" />
                  <span>Switch to {role === "clipper" ? "Creator" : "Clipper"}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              {bottomNav.map((item) => {
                const Icon = item.icon
                const active = location.pathname.startsWith(item.to)
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.label}
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
                <AvatarImage src={currentUser.avatarUrl} />
                <AvatarFallback>AM</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
                <p className="text-sm font-medium truncate">{currentUser.name}</p>
                <p className="text-[11px] text-muted-foreground truncate">
                  @{currentUser.handle}
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
                  <AvatarImage src={currentUser.avatarUrl} />
                  <AvatarFallback>AM</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{currentUser.name}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    @{currentUser.handle}
                  </p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="size-4" />
              Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Gear className="size-4" />
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem onClick={switchRole}>
              <ArrowsClockwise className="size-4" />
              Switch to {role === "clipper" ? "Creator" : "Clipper"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => {
                toast.success("Signed out")
                navigate("/login")
              }}
              className="text-destructive focus:text-destructive"
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
