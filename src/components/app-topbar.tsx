import { Link } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { Bell, Plus, Wallet } from "@phosphor-icons/react"

import { SidebarTrigger } from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { useAuth } from "@/hooks/use-auth"
import { formatCurrency } from "@/lib/mock-data"
import api from "@/lib/api"
import { QK } from "@/lib/query-keys"
import { PAYMENTS_V1_ENABLED } from "@/lib/feature-flags"

export function AppTopbar() {
  const { user } = useAuth()
  const isCreator = user?.role === "creator"

  const { data: unreadCount = 0 } = useQuery({
    queryKey: [QK.notifications.list, "topbarUnread"] as const,
    queryFn: async () => {
      const res = await api.get("/notifications?page=1&limit=1")
      return (res.data.unreadCount as number) ?? 0
    },
  })

  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-border/70 bg-background/80 px-3 backdrop-blur-xl md:px-6">
      <SidebarTrigger className="md:hidden" />
      <Separator orientation="vertical" className="mx-1 h-6 md:hidden" />

      <div className="ml-auto flex items-center gap-1 md:gap-2">
        {PAYMENTS_V1_ENABLED && (
          <Link
            to="/wallet"
            className="hidden items-center gap-2 rounded-full border border-border/80 bg-card/50 px-3 py-1.5 text-sm font-medium transition-colors hover:bg-card md:flex"
          >
            <Wallet className="size-4 text-primary" weight="fill" />
            <span className="tabular-nums">
              {formatCurrency(user?.walletBalance ?? 0)}
            </span>
          </Link>
        )}

        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
          asChild
        >
          <Link to="/notifications">
            <Bell className="size-4" />
            {unreadCount > 0 && (
              <Badge
                variant="destructive"
                className="absolute -right-1 -top-1 h-4 min-w-4 rounded-full px-1 text-[10px] font-semibold"
              >
                {unreadCount}
              </Badge>
            )}
          </Link>
        </Button>

        {isCreator && (
          <>
            <Button size="sm" asChild className="hidden sm:inline-flex">
              <Link to="/creator/campaigns/new">
                <Plus className="size-4" weight="bold" />
                New campaign
              </Link>
            </Button>
            <Button
              size="icon"
              asChild
              className="sm:hidden"
              aria-label="New campaign"
            >
              <Link to="/creator/campaigns/new">
                <Plus className="size-4" weight="bold" />
              </Link>
            </Button>
          </>
        )}
      </div>
    </header>
  )
}
