import { useCallback, useEffect, useRef, useState } from "react";
import {
  MagnifyingGlass,
  SlidersHorizontal,
  TrendUp,
} from "@phosphor-icons/react";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/page-header";
import { CampaignCard } from "@/components/campaign-card";
import { PaginationBar } from "@/components/pagination-bar";
import { TopCampaignsWidget } from "@/components/top-campaigns-widget";
import { useCampaigns, useTopCampaigns } from "@/queries/campaigns";
import { useAuth } from "@/hooks/use-auth";
import type { Platform } from "@/lib/types";

type SortKey = "newest" | "highest_rate" | "most_popular";

const platformOptions: { value: Platform; label: string }[] = [
  { value: "tiktok", label: "TikTok" },
  { value: "instagram", label: "Instagram Reels" },
];

export function HubPage() {
  const { user } = useAuth();
  const viewerIsCreator = user?.role === "creator";
  // Applied filters
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>([]);
  const [sort, setSort] = useState<SortKey>("newest");
  const [minRate, setMinRate] = useState("any");
  const [search, setSearch] = useState("");

  const [debouncedSearch, setDebouncedSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const handleSearch = useCallback((value: string) => {
    setSearch(value);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(
      () => setDebouncedSearch(value.trim()),
      300,
    );
  }, []);

  const [page, setPage] = useState(1);
  const limit = 20;

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, selectedPlatforms, minRate, sort]);

  const { data: resp, isLoading: loading } = useCampaigns({
    search: debouncedSearch || undefined,
    platforms: selectedPlatforms.length > 0 ? selectedPlatforms : undefined,
    minRate,
    hasBudget: true,
    sort: sort === "newest" ? undefined : sort,
    page,
    limit,
  });
  const campaigns = resp?.data ?? [];
  const meta = resp?.meta;

  // Sheet open state
  const [sheetOpen, setSheetOpen] = useState(false);

  // Draft filters (edited inside Sheet, applied on "Apply")
  const [draftPlatforms, setDraftPlatforms] = useState<Platform[]>([]);
  const [draftSort, setDraftSort] = useState<SortKey>("newest");
  const [draftMinRate, setDraftMinRate] = useState("any");

  const openSheet = () => {
    setDraftPlatforms([...selectedPlatforms]);
    setDraftSort(sort);
    setDraftMinRate(minRate);
    setSheetOpen(true);
  };

  const applyFilters = () => {
    setSelectedPlatforms(draftPlatforms);
    setSort(draftSort);
    setMinRate(draftMinRate);
    setSheetOpen(false);
  };

  const clearDraft = () => {
    setDraftPlatforms([]);
    setDraftSort("newest");
    setDraftMinRate("any");
  };

  const toggleDraftPlatform = (p: Platform) => {
    setDraftPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  };

  const activeFilterCount =
    (selectedPlatforms.length > 0 ? 1 : 0) +
    (minRate !== "any" ? 1 : 0) +
    (sort !== "newest" ? 1 : 0);

  const filtered = campaigns;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-6 md:py-8">
      <PageHeader
        title="Content Rewards hub"
        description={
          viewerIsCreator
            ? "Browse active clipping campaigns from creators across the platform."
            : "Browse active clipping campaigns and earn per 1,000 verified views."
        }
        className="mb-6"
      />

      <TopCampaignsChipBlock />

      {/* Search + Filters */}
      <div className="mb-6 flex gap-2">
        <div className="relative flex-1">
          <MagnifyingGlass className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search campaigns or creators…"
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Sheet
          open={sheetOpen}
          onOpenChange={(v) => {
            if (!v) setSheetOpen(false);
          }}
        >
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
          <SheetContent
            side="right"
            showCloseButton={false}
            className="flex flex-col"
          >
            <SheetHeader>
              <SheetTitle>Filters</SheetTitle>
            </SheetHeader>
            <div className="flex-1 overflow-y-auto">
              <div className="flex flex-col gap-6 p-6">
                {/* Platforms */}
                <div className="flex flex-col gap-2.5">
                  <Label className="text-sm font-medium">Platform</Label>
                  {platformOptions.map((p) => (
                    <label
                      key={p.value}
                      className="flex cursor-pointer items-center gap-3"
                    >
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
                  <Select
                    value={draftSort}
                    onValueChange={(v) => setDraftSort(v as SortKey)}
                  >
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
                  <Button onClick={applyFilters}>Apply</Button>
                </div>
              </div>
            </SheetFooter>
          </SheetContent>
        </Sheet>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card
              key={i}
              className="overflow-hidden border-border/60 bg-card/70"
            >
              <Skeleton className="aspect-video w-full" />
              <div className="p-4 space-y-3">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Grid */}
      {!loading &&
        (filtered.length === 0 ? (
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
                setSelectedPlatforms([]);
                setMinRate("any");
                setSearch("");
                setSort("newest");
              }}
            >
              Reset filters
            </Button>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filtered.map((c) => (
                <CampaignCard key={c.id} campaign={c} />
              ))}
            </div>
            {meta && (
              <PaginationBar
                page={meta.page}
                limit={meta.limit}
                totalItems={meta.totalItems}
                totalPages={meta.totalPages}
                onPageChange={setPage}
              />
            )}
          </>
        ))}
    </div>
  );
}

function TopCampaignsChipBlock() {
  const { data: campaigns, isLoading } = useTopCampaigns(20);
  const all = campaigns ?? [];
  const mobilePreview = all.slice(0, 3);
  const desktopPreview = all.slice(0, 5);
  const remainingMobile = Math.max(0, all.length - mobilePreview.length);
  const remainingDesktop = Math.max(0, all.length - desktopPreview.length);

  if (!isLoading && all.length === 0) return null;

  return (
    <div className="mb-6">
      <Popover>
        <PopoverTrigger asChild>
          <button className="group flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-card/70 px-4 py-2.5 text-left backdrop-blur transition-colors hover:border-primary/40 hover:bg-card">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <TrendUp weight="fill" className="size-4" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">Top campaigns</p>
              <p className="text-xs text-muted-foreground">
                {isLoading
                  ? "Loading…"
                  : "Best performing campaigns by views · click to view all"}
              </p>
            </div>
            {all.length > 0 && (
              <>
                <div className="flex -space-x-2 sm:hidden">
                  {mobilePreview.map((c) => (
                    <div
                      key={c.id}
                      className="size-7 shrink-0 overflow-hidden rounded-md ring-2 ring-card"
                    >
                      {c.sourceThumbnailUrl ? (
                        <img
                          src={c.sourceThumbnailUrl}
                          alt={c.title}
                          className="size-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="size-full bg-muted" />
                      )}
                    </div>
                  ))}
                  {remainingMobile > 0 && (
                    <div className="flex size-7 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card tabular-nums">
                      +{remainingMobile}
                    </div>
                  )}
                </div>
                <div className="hidden -space-x-2 sm:flex">
                  {desktopPreview.map((c) => (
                    <div
                      key={c.id}
                      className="size-7 shrink-0 overflow-hidden rounded-md ring-2 ring-card"
                    >
                      {c.sourceThumbnailUrl ? (
                        <img
                          src={c.sourceThumbnailUrl}
                          alt={c.title}
                          className="size-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="size-full bg-muted" />
                      )}
                    </div>
                  ))}
                  {remainingDesktop > 0 && (
                    <div className="flex size-7 items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-card tabular-nums">
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
          className="w-[360px] gap-0 overflow-hidden border border-white/15 bg-card p-0"
        >
          <div className="flex items-center gap-2 border-b border-border/40 bg-card px-6 py-3 text-sm font-medium">
            <TrendUp className="size-4 text-primary" weight="fill" />
            Top campaigns
          </div>
          <div className="max-h-[380px] overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <TopCampaignsWidget
              limit={20}
              showHeader={false}
              className="rounded-none border-0 bg-transparent shadow-none ring-0 backdrop-blur-0"
            />
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
