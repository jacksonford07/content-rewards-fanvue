import { useMemo, useState } from "react"
import { MagnifyingGlass, SlidersHorizontal } from "@phosphor-icons/react"

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
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { PageHeader } from "@/components/page-header"
import { CampaignCard } from "@/components/campaign-card"
import { campaigns } from "@/lib/mock-data"
import type { Platform } from "@/lib/types"

type SortKey = "newest" | "highest_rate" | "most_popular"

const platformOptions: { value: Platform; label: string }[] = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram Reels" },
  { value: "youtube", label: "YouTube Shorts" },
]

export function HubPage() {
  // Applied filters
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([])
  const [sort, setSort] = useState<SortKey>("newest")
  const [minRate, setMinRate] = useState("any")
  const [search, setSearch] = useState("")
  const [hasBudget, setHasBudget] = useState(false)

  // Sheet open state
  const [sheetOpen, setSheetOpen] = useState(false)

  // Draft filters (edited inside Sheet, applied on "Apply")
  const [draftPlatforms, setDraftPlatforms] = useState<Platform[]>([])
  const [draftSort, setDraftSort] = useState<SortKey>("newest")
  const [draftMinRate, setDraftMinRate] = useState("any")
  const [draftHasBudget, setDraftHasBudget] = useState(false)

  const openSheet = () => {
    setDraftPlatforms([...selectedPlatforms])
    setDraftSort(sort)
    setDraftMinRate(minRate)
    setDraftHasBudget(hasBudget)
    setSheetOpen(true)
  }

  const applyFilters = () => {
    setSelectedPlatforms(draftPlatforms)
    setSort(draftSort)
    setMinRate(draftMinRate)
    setHasBudget(draftHasBudget)
    setSheetOpen(false)
  }

  const clearDraft = () => {
    setDraftPlatforms([])
    setDraftSort("newest")
    setDraftMinRate("any")
    setDraftHasBudget(false)
  }

  const toggleDraftPlatform = (p: Platform) => {
    setDraftPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]
    )
  }

  const activeFilterCount =
    (selectedPlatforms.length > 0 ? 1 : 0) +
    (minRate !== "any" ? 1 : 0) +
    (hasBudget ? 1 : 0) +
    (sort !== "newest" ? 1 : 0)

  const filtered = useMemo(() => {
    let list = campaigns.filter((c) => c.status === "active")
    if (selectedPlatforms.length > 0)
      list = list.filter((c) =>
        selectedPlatforms.some((p) => c.allowedPlatforms.includes(p))
      )
    if (minRate !== "any") {
      const min = parseFloat(minRate)
      list = list.filter((c) => c.rewardRatePer1k >= min)
    }
    if (hasBudget)
      list = list.filter((c) => c.totalBudget - c.budgetSpent > 0)
    if (search.trim())
      list = list.filter(
        (c) =>
          c.title.toLowerCase().includes(search.toLowerCase()) ||
          c.creator.name.toLowerCase().includes(search.toLowerCase())
      )
    if (sort === "highest_rate")
      list = [...list].sort((a, b) => b.rewardRatePer1k - a.rewardRatePer1k)
    else if (sort === "most_popular")
      list = [...list].sort((a, b) => b.totalViews - a.totalViews)
    else
      list = [...list].sort(
        (a, b) =>
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    return list
  }, [selectedPlatforms, minRate, sort, search, hasBudget])

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Content Rewards hub"
        description="Browse active clipping campaigns and earn per 1,000 verified views."
        className="mb-6"
      />

      {/* Search + Filters */}
      <div className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search campaigns or creators…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Sheet open={sheetOpen} onOpenChange={(v) => { if (!v) setSheetOpen(false) }}>
          <SheetTrigger asChild>
            <Button variant="outline" size="default" className="relative shrink-0 gap-2" onClick={openSheet}>
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
                {/* Platforms */}
                <div className="flex flex-col gap-2.5">
                  <Label className="text-sm font-medium">Platform</Label>
                  {platformOptions.map((p) => (
                    <label key={p.value} className="flex cursor-pointer items-center gap-3">
                      <Checkbox
                        checked={draftPlatforms.includes(p.value)}
                        onCheckedChange={() => toggleDraftPlatform(p.value)}
                      />
                      <span className="text-sm">{p.label}</span>
                    </label>
                  ))}
                </div>

                <hr className="border-border/60" />

                {/* Sort */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium">Sort by</Label>
                  <Select value={draftSort} onValueChange={(v) => setDraftSort(v as SortKey)}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="highest_rate">Highest rate</SelectItem>
                      <SelectItem value="most_popular">Most popular</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <hr className="border-border/60" />

                {/* Min reward rate */}
                <div className="flex flex-col gap-2">
                  <Label className="text-sm font-medium">Minimum reward</Label>
                  <Select value={draftMinRate} onValueChange={setDraftMinRate}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="any">Any reward</SelectItem>
                      <SelectItem value="2">$2+ / 1K views</SelectItem>
                      <SelectItem value="3">$3+ / 1K views</SelectItem>
                      <SelectItem value="5">$5+ / 1K views</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <hr className="border-border/60" />

                {/* Budget available */}
                <label className="flex cursor-pointer items-center gap-3">
                  <Checkbox
                    checked={draftHasBudget}
                    onCheckedChange={(v) => setDraftHasBudget(Boolean(v))}
                  />
                  <span className="text-sm font-medium">Budget available only</span>
                </label>
              </div>
            </div>

            {/* Footer: Clear all — Cancel — Apply */}
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
                  <Button onClick={applyFilters}>
                    Apply
                  </Button>
                </div>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center gap-3 p-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full bg-muted">
            <MagnifyingGlass className="size-5 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold">No campaigns found</h3>
          <p className="max-w-sm text-sm text-muted-foreground">
            Try adjusting your filters or search to find campaigns that match
            your preferences.
          </p>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedPlatforms([])
              setMinRate("any")
              setSearch("")
              setHasBudget(false)
              setSort("newest")
            }}
          >
            Reset filters
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filtered.map((c) => (
            <CampaignCard key={c.id} campaign={c} />
          ))}
        </div>
      )}
    </div>
  )
}
