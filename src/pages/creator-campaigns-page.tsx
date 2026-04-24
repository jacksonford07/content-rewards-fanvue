import { useCallback, useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import {
  Plus,
  Eye,
  Users,
  CurrencyDollar,
  DotsThreeVertical,
  TrendUp,
  Lightning,
  PencilSimple,
  PauseCircle,
  PlayCircle,
  ChartLine,
  Tray,
  Wallet,
  FilmSlate,
  Trash,
  MagnifyingGlass,
  SlidersHorizontal,
  Lock,
  Globe,
  LinkSimple,
  Trophy,
  X,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { PageHeader } from "@/components/page-header"
import { PlatformIcon } from "@/components/platform-icon"
import {
  formatCompactNumber,
  formatCurrency,
} from "@/lib/mock-data"
import {
  useDeleteCampaign,
  useMyCampaigns,
  useMyCampaignsStats,
  usePauseCampaign,
  useTopClippers,
} from "@/queries/campaigns"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TopClippersWidget } from "@/components/top-clippers-widget"
import { PaginationBar } from "@/components/pagination-bar"
import type { Campaign } from "@/lib/types"

type StatusKey = "active" | "paused" | "completed" | "draft" | "pending_budget"
type SortKey = "newest" | "highest_spend" | "highest_budget"

const statusOptions: { value: StatusKey; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "pending_budget", label: "Awaiting budget" },
  { value: "draft", label: "Draft" },
  { value: "completed", label: "Completed" },
]


export function CreatorCampaignsPage() {
  const [pauseTarget, setPauseTarget] = useState<Campaign | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Campaign | null>(null)

  // Applied filters
  const [selectedStatuses, setSelectedStatuses] = useState<StatusKey[]>([])
  const [sort, setSort] = useState<SortKey>("newest")
  const [search, setSearch] = useState("")

  const [debouncedSearch, setDebouncedSearch] = useState("")
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const handleSearch = useCallback((value: string) => {
    setSearch(value)
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => setDebouncedSearch(value.trim()), 300)
  }, [])

  const [page, setPage] = useState(1)
  const limit = 20

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, selectedStatuses, sort])

  const { data: resp, isLoading: loading } = useMyCampaigns({
    search: debouncedSearch || undefined,
    status: selectedStatuses.length > 0 ? selectedStatuses : undefined,
    sort: sort === "newest" ? undefined : sort,
    page,
    limit,
  })
  const myCampaigns = resp?.data ?? []
  const meta = resp?.meta
  const {
    data: stats = {
      activeCampaigns: 0,
      totalClippers: 0,
      totalViews: 0,
      totalSpend: 0,
    },
    isLoading: statsLoading,
  } = useMyCampaignsStats()

  const pauseMutation = usePauseCampaign()
  const deleteMutation = useDeleteCampaign()

  // Filter sheet state
  const [sheetOpen, setSheetOpen] = useState(false)
  const [draftStatuses, setDraftStatuses] = useState<StatusKey[]>([])
  const [draftSort, setDraftSort] = useState<SortKey>("newest")

  const openSheet = () => {
    setDraftStatuses([...selectedStatuses])
    setDraftSort(sort)
    setSheetOpen(true)
  }

  const applyFilters = () => {
    setSelectedStatuses(draftStatuses)
    setSort(draftSort)
    setSheetOpen(false)
  }

  const clearDraft = () => {
    setDraftStatuses([])
    setDraftSort("newest")
  }

  const toggleDraftStatus = (s: StatusKey) => {
    setDraftStatuses((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
    )
  }

  const activeFilterCount =
    (selectedStatuses.length > 0 ? 1 : 0) + (sort !== "newest" ? 1 : 0)

  const confirmTogglePause = async () => {
    if (!pauseTarget) return
    try {
      const res = await pauseMutation.mutateAsync(pauseTarget.id)
      toast.success(res.status === "paused" ? "Campaign paused" : "Campaign resumed")
    } catch {
      toast.error("Failed to update campaign")
    }
    setPauseTarget(null)
  }

  const confirmDelete = async () => {
    if (!deleteTarget) return
    try {
      await deleteMutation.mutateAsync(deleteTarget.id)
      toast.success("Campaign deleted")
    } catch {
      toast.error("Failed to delete campaign")
    }
    setDeleteTarget(null)
  }


  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="My campaigns"
        description="Manage your clipping campaigns, track performance, and fund budgets."
        actions={
          <Button asChild>
            <Link to="/creator/campaigns/new">
              <Plus className="size-4" weight="bold" />
              New campaign
            </Link>
          </Button>
        }
        className="mb-6"
      />

      <TopClippersChipBlock />

      {/* Quick stats (computed server-side, independent of filters) */}
      {statsLoading ? (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="border-border/60 bg-card/70 p-3.5">
              <div className="flex items-center gap-3">
                <Skeleton className="size-9 shrink-0 rounded-lg" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-2.5 w-20" />
                  <Skeleton className="h-6 w-16" />
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          <DashStat
            icon={<Lightning className="size-4" weight="fill" />}
            label="Active campaigns"
            value={stats.activeCampaigns.toString()}
            accent="success"
          />
          <DashStat
            icon={<Users className="size-4" weight="fill" />}
            label="Total clippers"
            value={stats.totalClippers.toString()}
            accent="primary"
          />
          <DashStat
            icon={<Eye className="size-4" weight="fill" />}
            label="Total views"
            value={formatCompactNumber(stats.totalViews)}
            accent="primary"
          />
          <DashStat
            icon={<CurrencyDollar className="size-4" weight="fill" />}
            label="Total spend"
            value={formatCurrency(stats.totalSpend)}
            accent="warning"
          />
        </div>
      )}

      {/* Search + Filters */}
      <div className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search your campaigns…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Sheet open={sheetOpen} onOpenChange={(v) => { if (!v) setSheetOpen(false) }}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="default"
              className="relative shrink-0 gap-2"
              onClick={openSheet}
            >
              <SlidersHorizontal className="size-4" />
              <span className="hidden sm:inline">Filters</span>
              {activeFilterCount > 0 && (
                <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="right" showCloseButton={false} className="flex flex-col">
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col gap-6 p-6">
                <div className="flex flex-col gap-2.5">
                  <Label className="text-sm font-medium">Status</Label>
                  {statusOptions.map((s) => (
                    <label key={s.value} className="flex cursor-pointer items-center gap-3">
                      <Checkbox
                        checked={draftStatuses.includes(s.value)}
                        onCheckedChange={() => toggleDraftStatus(s.value)}
                      />
                      <span className="text-sm">{s.label}</span>
                    </label>
                  ))}
                </div>

                <hr className="border-border/60" />

                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium">Sort by</Label>
                  <Select value={draftSort} onValueChange={(v) => setDraftSort(v as SortKey)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="highest_spend">Highest spend</SelectItem>
                      <SelectItem value="highest_budget">Highest budget</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <SheetFooter className="border-t border-border/60">
              <div className="flex w-full items-center">
                <button
                  type="button"
                  className="text-sm font-medium underline underline-offset-4 text-muted-foreground hover:text-foreground transition-colors"
                  onClick={clearDraft}
                >
                  Clear all
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <Button variant="outline" onClick={() => setSheetOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={applyFilters}>Apply</Button>
                </div>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Campaign cards */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="border-border/60 bg-card/70">
              <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:p-5">
                <Skeleton className="aspect-video w-full shrink-0 rounded-lg md:h-24 md:w-40" />
                <div className="min-w-0 flex-1 space-y-3">
                  <Skeleton className="h-5 w-16" />
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <div className="grid grid-cols-4 gap-3">
                    {Array.from({ length: 4 }).map((_, j) => (
                      <Skeleton key={j} className="h-8 w-full" />
                    ))}
                  </div>
                  <Skeleton className="h-1.5 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : myCampaigns.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <MagnifyingGlass className="size-5 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No campaigns found</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            {activeFilterCount > 0 || search
              ? "Try adjusting your filters or search to find campaigns."
              : "Create your first campaign to start earning clips."}
          </p>
          {(activeFilterCount > 0 || search) && (
            <Button
              variant="outline"
              onClick={() => {
                setSelectedStatuses([])
                setSort("newest")
                setSearch("")
                setDebouncedSearch("")
              }}
            >
              Reset filters
            </Button>
          )}
        </Card>
      ) : (
        <div className="space-y-4">
          {myCampaigns.map((c) => {
            const reserved = c.budgetReserved ?? 0
            const available =
              c.budgetAvailable ??
              Math.max(c.totalBudget - c.budgetSpent - reserved, 0)
            const spentPct = c.totalBudget
              ? Math.min(100, Math.round((c.budgetSpent / c.totalBudget) * 100))
              : 0
            const reservedPct = c.totalBudget
              ? Math.min(
                  100 - spentPct,
                  Math.round((reserved / c.totalBudget) * 100),
                )
              : 0
            const isPreviewable =
              c.status !== "draft" && c.status !== "pending_budget"
            const ThumbWrap = ({ children }: { children: React.ReactNode }) =>
              isPreviewable ? (
                <Link
                  to={`/campaigns/${c.id}`}
                  className="shrink-0 md:h-24 md:w-40"
                >
                  {children}
                </Link>
              ) : (
                <div className="shrink-0 md:h-24 md:w-40">{children}</div>
              )
            return (
              <Card
                key={c.id}
                className="overflow-hidden border-border/60 bg-card/70 backdrop-blur"
              >
                <CardContent className="flex flex-col gap-4 p-4 md:flex-row md:p-5">
                  {c.sourceThumbnailUrl ? (
                    <ThumbWrap>
                      <img
                        src={c.sourceThumbnailUrl}
                        alt={c.title}
                        className="aspect-video w-full rounded-lg object-cover md:h-24 md:w-40"
                        referrerPolicy="no-referrer"
                      />
                    </ThumbWrap>
                  ) : (
                    <ThumbWrap>
                      <div className="flex aspect-video w-full items-center justify-center rounded-lg bg-muted md:h-24 md:w-40">
                        <FilmSlate className="size-8 text-muted-foreground/50" />
                      </div>
                    </ThumbWrap>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                          <Badge
                            variant="outline"
                            className={
                              c.status === "active" && available <= 0
                                ? "border-warning/40 bg-warning/10 text-warning"
                                : c.status === "active"
                                ? "border-success/40 bg-success/10 text-success"
                                : c.status === "pending_budget"
                                ? "border-primary/40 bg-primary/10 text-primary"
                                : c.status === "completed"
                                ? "border-border bg-muted text-muted-foreground"
                                : c.status === "paused"
                                ? "border-warning/40 bg-warning/10 text-warning"
                                : "border-border bg-muted text-muted-foreground"
                            }
                          >
                            {c.status === "active" && available <= 0 ? (
                              <Lock weight="fill" className="size-3" />
                            ) : c.status === "active" ? (
                              <Lightning weight="fill" className="size-3" />
                            ) : c.status === "draft" ? (
                              <PencilSimple weight="fill" className="size-3" />
                            ) : null}
                            {c.status === "active" && available <= 0
                              ? "Funds exhausted"
                              : c.status === "pending_budget"
                              ? "Awaiting budget"
                              : c.status.charAt(0).toUpperCase() + c.status.slice(1)}
                          </Badge>
                          {c.isPrivate ? (
                            <Badge
                              variant="outline"
                              className="border-primary/40 bg-primary/10 text-primary"
                            >
                              <Lock weight="fill" className="size-3" />
                              Private
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="border-border/70 bg-muted/50 text-muted-foreground"
                            >
                              <Globe weight="fill" className="size-3" />
                              Public
                            </Badge>
                          )}
                        </div>
                        {isPreviewable ? (
                          <Link to={`/campaigns/${c.id}`} className="block">
                            <h3 className="truncate text-base font-semibold hover:text-primary">
                              {c.title}
                            </h3>
                          </Link>
                        ) : (
                          <h3 className="truncate text-base font-semibold">
                            {c.title}
                          </h3>
                        )}
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          {c.description}
                        </p>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="shrink-0">
                            <DotsThreeVertical className="size-4" weight="bold" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {isPreviewable && (
                            <DropdownMenuItem asChild>
                              <Link to={`/campaigns/${c.id}`}>
                                <Eye className="size-4" />
                                View details
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {c.isPrivate && c.privateSlug && (
                            <DropdownMenuItem
                              onClick={async () => {
                                const url = `${window.location.origin}/c/${c.privateSlug}`
                                try {
                                  await navigator.clipboard.writeText(url)
                                  toast.success("Invite link copied")
                                } catch {
                                  toast.error("Failed to copy link")
                                }
                              }}
                            >
                              <LinkSimple className="size-4" />
                              Copy invite link
                            </DropdownMenuItem>
                          )}
                          {c.status !== "draft" && c.status !== "pending_budget" && (
                            <DropdownMenuItem asChild>
                              <Link to="/creator/inbox">
                                <Tray className="size-4" />
                                View submissions
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {(c.status === "draft" || c.status === "pending_budget") && (
                            <DropdownMenuItem asChild>
                              <Link to={`/creator/campaigns/${c.id}/edit`}>
                                <PencilSimple className="size-4" />
                                Continue editing
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {c.status !== "draft" && c.status !== "pending_budget" && (
                            <DropdownMenuItem asChild>
                              <Link to={`/creator/campaigns/${c.id}/budget`}>
                                <Wallet className="size-4" />
                                Manage budget
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {c.status !== "draft" && c.status !== "pending_budget" && (
                            <DropdownMenuItem asChild>
                              <Link to={`/creator/analytics?campaign=${c.id}`}>
                                <ChartLine className="size-4" />
                                View analytics
                              </Link>
                            </DropdownMenuItem>
                          )}
                          {(c.status === "active" || c.status === "paused") && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => setPauseTarget(c)}>
                                {c.status === "paused" ? (
                                  <PlayCircle className="size-4" />
                                ) : (
                                  <PauseCircle className="size-4" />
                                )}
                                {c.status === "paused" ? "Resume campaign" : "Pause campaign"}
                              </DropdownMenuItem>
                              <DropdownMenuItem asChild>
                                <Link to={`/creator/campaigns/${c.id}/budget`}>
                                  <X className="size-4" />
                                  Complete & refund
                                </Link>
                              </DropdownMenuItem>
                            </>
                          )}
                          {(c.status === "draft" || c.status === "pending_budget") && c.budgetSpent === 0 && (
                            <>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem variant="destructive" onClick={() => setDeleteTarget(c)}>
                                <Trash className="size-4" />
                                Delete campaign
                              </DropdownMenuItem>
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-4">
                      <MiniStat
                        label="Rate"
                        value={`${formatCurrency(c.rewardRatePer1k)}/1K`}
                      />
                      <MiniStat
                        label="Views"
                        value={formatCompactNumber(c.totalViews)}
                      />
                      <MiniStat
                        label="Clippers"
                        value={c.activeClippers.toString()}
                      />
                      <MiniStat
                        label="Submissions"
                        value={c.totalSubmissions.toString()}
                      />
                    </div>

                    <div className="mt-4 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="min-w-0 truncate text-muted-foreground">
                          <span className="font-medium text-foreground tabular-nums">
                            {formatCurrency(available)}
                          </span>{" "}
                          available of {formatCurrency(c.totalBudget)}
                        </span>
                        <span className="flex shrink-0 items-center gap-1 text-muted-foreground">
                          {c.allowedPlatforms.map((p) => (
                            <PlatformIcon key={p} platform={p} className="size-3" />
                          ))}
                        </span>
                      </div>
                      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className="absolute inset-y-0 left-0 bg-primary"
                          style={{ width: `${spentPct}%` }}
                        />
                        <div
                          className="absolute inset-y-0 bg-primary/40"
                          style={{
                            left: `${spentPct}%`,
                            width: `${reservedPct}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {meta && (
        <PaginationBar
          page={meta.page}
          limit={meta.limit}
          totalItems={meta.totalItems}
          totalPages={meta.totalPages}
          onPageChange={setPage}
        />
      )}

      <AlertDialog
        open={!!pauseTarget}
        onOpenChange={(open) => {
          if (!open && !pauseMutation.isPending) setPauseTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pauseTarget?.status === "paused" ? "Resume campaign?" : "Pause campaign?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pauseTarget?.status === "paused"
                ? `"${pauseTarget?.title}" will become visible to clippers again and accept new submissions.`
                : `"${pauseTarget?.title}" will be hidden from the hub. Existing submissions will still be processed, but no new clips can be submitted.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pauseMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button loading={pauseMutation.isPending} onClick={confirmTogglePause}>
              {pauseTarget?.status === "paused" ? "Resume" : "Pause"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open && !deleteMutation.isPending) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete campaign?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" will be permanently deleted. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              loading={deleteMutation.isPending}
              onClick={confirmDelete}
            >
              Delete
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function DashStat({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode
  label: string
  value: string
  accent?: "success" | "warning" | "primary"
}) {
  const accentClasses: Record<string, string> = {
    success: "border-success/30 bg-success/5 text-success",
    warning: "border-warning/30 bg-warning/5 text-warning",
    primary: "border-primary/30 bg-primary/5 text-primary",
  }
  return (
    <Card className="border-border/60 bg-card/70 p-3.5 backdrop-blur">
      <div className="flex items-center gap-3">
        <div
          className={`inline-flex size-9 shrink-0 items-center justify-center rounded-lg border ${
            accent ? accentClasses[accent] : "border-border bg-muted"
          }`}
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {label}
          </p>
          <p className="truncate text-xl font-semibold leading-tight tabular-nums">
            {value}
          </p>
        </div>
        <TrendUp
          weight="bold"
          className="size-4 shrink-0 text-success opacity-80"
        />
      </div>
    </Card>
  )
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function TopClippersChipBlock() {
  const { data: clippers, isLoading } = useTopClippers(20)
  const all = clippers ?? []
  const mobilePreview = all.slice(0, 3)
  const desktopPreview = all.slice(0, 5)
  const remainingMobile = Math.max(0, all.length - mobilePreview.length)
  const remainingDesktop = Math.max(0, all.length - desktopPreview.length)

  if (!isLoading && all.length === 0) return null

  return (
    <div className="mb-6">
      <Popover>
        <PopoverTrigger asChild>
          <button className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-card/70 px-4 py-2.5 text-left backdrop-blur transition-colors hover:border-primary/40 hover:bg-card">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Trophy weight="fill" className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Top clippers</p>
              <p className="text-xs text-muted-foreground">
                {isLoading
                  ? "Loading…"
                  : `Best performing clippers by earnings · click to view all`}
              </p>
            </div>
            {all.length > 0 && (
              <>
                <div className="flex -space-x-2 sm:hidden">
                  {mobilePreview.map((c) => (
                    <Avatar key={c.id} className="size-7 ring-2 ring-card">
                      <AvatarImage src={c.avatarUrl} />
                      <AvatarFallback className="text-[10px]">
                        {c.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {remainingMobile > 0 && (
                    <div className="flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card tabular-nums">
                      +{remainingMobile}
                    </div>
                  )}
                </div>
                <div className="hidden -space-x-2 sm:flex">
                  {desktopPreview.map((c) => (
                    <Avatar key={c.id} className="size-7 ring-2 ring-card">
                      <AvatarImage src={c.avatarUrl} />
                      <AvatarFallback className="text-[10px]">
                        {c.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                  ))}
                  {remainingDesktop > 0 && (
                    <div className="flex size-7 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card tabular-nums">
                      +{remainingDesktop}
                    </div>
                  )}
                </div>
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="end"
          className="w-[340px] gap-0 overflow-hidden border border-white/15 bg-card p-0"
        >
          <div className="flex items-center gap-2 border-b border-border/40 bg-card px-6 py-3 text-sm font-medium">
            <Trophy className="size-4 text-primary" weight="fill" />
            Top clippers
          </div>
          <div className="max-h-[380px] overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TopClippersWidget
              limit={20}
              showHeader={false}
              className="rounded-none border-0 bg-transparent shadow-none ring-0 backdrop-blur-0"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  )
}
