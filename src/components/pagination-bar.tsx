import { useRef } from "react"
import { CaretLeft, CaretRight } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"

interface PaginationBarProps {
  page: number
  limit: number
  totalItems: number
  totalPages: number
  onPageChange: (page: number) => void
}

function findScrollableAncestor(el: HTMLElement | null): HTMLElement | null {
  let node: HTMLElement | null = el?.parentElement ?? null
  while (node && node !== document.body) {
    const style = window.getComputedStyle(node)
    const oy = style.overflowY
    if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight) {
      return node
    }
    node = node.parentElement
  }
  return null
}

export function PaginationBar({
  page,
  limit,
  totalItems,
  totalPages,
  onPageChange,
}: PaginationBarProps) {
  const rootRef = useRef<HTMLDivElement>(null)

  if (totalPages <= 1) return null
  const first = (page - 1) * limit + 1
  const last = Math.min(page * limit, totalItems)

  const go = (p: number) => {
    // Scroll BEFORE state change so the current (full-height) page is still in the DOM.
    const scroller =
      findScrollableAncestor(rootRef.current) ??
      (document.scrollingElement as HTMLElement | null) ??
      document.documentElement
    scroller?.scrollTo({ top: 0, behavior: "auto" })
    onPageChange(p)
    // Re-assert after React commits the new data, in case layout shifted.
    requestAnimationFrame(() => {
      scroller?.scrollTo({ top: 0, behavior: "auto" })
    })
  }

  return (
    <div
      ref={rootRef}
      className="flex items-center justify-between gap-3 px-1 pt-3 text-xs text-muted-foreground"
    >
      <p className="tabular-nums">
        {first}–{last} of {totalItems}
      </p>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => go(page - 1)}
        >
          <CaretLeft className="size-3.5" />
          Prev
        </Button>
        <span className="px-2 tabular-nums">
          {page} / {totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => go(page + 1)}
        >
          Next
          <CaretRight className="size-3.5" />
        </Button>
      </div>
    </div>
  )
}
