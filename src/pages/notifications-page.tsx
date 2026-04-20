import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import {
  Bell,
  CheckCircle,
  XCircle,
  CurrencyDollar,
  Tray,
  WarningCircle,
  ArrowRight,
} from "@phosphor-icons/react"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/page-header"
import { PaginationBar } from "@/components/pagination-bar"
import { timeAgo } from "@/lib/mock-data"
import { cn } from "@/lib/utils"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useNotifications,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
  type Notification,
} from "@/queries/notifications"

const iconMap: Record<
  Notification["type"],
  {
    icon: React.ComponentType<{ className?: string; weight?: "fill" | "regular" }>
    className: string
  }
> = {
  new_submission: {
    icon: Tray,
    className: "border-primary/30 bg-primary/10 text-primary",
  },
  approved: {
    icon: CheckCircle,
    className: "border-success/30 bg-success/10 text-success",
  },
  rejected: {
    icon: XCircle,
    className: "border-destructive/30 bg-destructive/10 text-destructive",
  },
  payout_released: {
    icon: CurrencyDollar,
    className: "border-primary/30 bg-primary/10 text-primary",
  },
  low_budget: {
    icon: WarningCircle,
    className: "border-warning/30 bg-warning/10 text-warning",
  },
  views_ready: {
    icon: CheckCircle,
    className: "border-primary/30 bg-primary/10 text-primary",
  },
}

function resolveActionUrl(n: Notification): string {
  // If the stored URL already carries a tab or points somewhere specific, keep it
  if (n.actionUrl && n.actionUrl.includes("?")) return n.actionUrl
  switch (n.type) {
    case "approved":
      return "/submissions?tab=approved"
    case "rejected":
      return "/submissions?tab=rejected"
    case "new_submission":
      return "/creator/inbox?tab=pending"
    case "payout_released":
      return "/wallet"
    default:
      return n.actionUrl ?? "#"
  }
}

export function NotificationsPage() {
  const [page, setPage] = useState(1)
  const limit = 20
  const { data, isLoading: loading } = useNotifications({ page, limit })
  const notifications: Notification[] = data?.notifications ?? []
  const unread = data?.unreadCount ?? 0
  const meta = data?.meta

  const markAllReadMutation = useMarkAllNotificationsRead()
  const markReadMutation = useMarkNotificationRead()

  // Auto mark all as read when the user opens the notifications page
  useEffect(() => {
    if (!loading && unread > 0) {
      markAllReadMutation.mutate()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const markAllRead = () => markAllReadMutation.mutate()
  const markRead = (id: string) => markReadMutation.mutate(id)

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Notifications"
        description={`${unread} unread · activity across your campaigns and submissions.`}
        actions={
          <Button variant="outline" size="sm" onClick={markAllRead}>
            Mark all read
          </Button>
        }
        className="mb-6"
      />

      <Card className="border-border/60 bg-card/70 backdrop-blur">
        <CardContent className="divide-y divide-border/50 p-0">
          {loading ? (
            Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3 p-4">
                <Skeleton className="size-9 shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                  <Skeleton className="h-3 w-20" />
                </div>
              </div>
            ))
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <Bell className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                You're all caught up.
              </p>
            </div>
          ) : (
            notifications.map((n) => {
              const { icon: Icon, className } = iconMap[n.type]
              return (
                <Link
                  key={n.id}
                  to={resolveActionUrl(n)}
                  onClick={() => { if (!n.read) markRead(n.id) }}
                  className={cn(
                    "group flex items-start gap-3 p-4 transition-colors hover:bg-muted/40 md:gap-4 md:p-5",
                    !n.read && "bg-primary/[0.03]"
                  )}
                >
                  <div
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-full border",
                      className
                    )}
                  >
                    <Icon className="size-4" weight="fill" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-semibold">
                        {n.title}
                      </p>
                      {!n.read && (
                        <Badge
                          variant="outline"
                          className="h-4 border-primary/40 bg-primary/10 px-1.5 text-[9px] text-primary"
                        >
                          NEW
                        </Badge>
                      )}
                    </div>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {n.message}
                    </p>
                    <p className="mt-1 text-[11px] text-muted-foreground/80">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                  <ArrowRight
                    weight="bold"
                    className="size-4 shrink-0 self-center text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
                  />
                </Link>
              )
            })
          )}
        </CardContent>
      </Card>

      {meta && (
        <PaginationBar
          page={meta.page}
          limit={meta.limit}
          totalItems={meta.totalItems}
          totalPages={meta.totalPages}
          onPageChange={setPage}
        />
      )}
    </div>
  )
}
