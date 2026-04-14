import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { Outlet } from "react-router-dom"

import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AppTopbar } from "@/components/app-topbar"
import { useIsMobile } from "@/hooks/use-mobile"

type SidebarHoverCtx = {
  setPopoverOpen: (open: boolean) => void
}

const SidebarHoverContext = createContext<SidebarHoverCtx>({
  setPopoverOpen: () => {},
})

export function useSidebarHover() {
  return useContext(SidebarHoverContext)
}

export function AppLayout() {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  // State (not just ref) so the mousemove effect re-runs when dropdown opens/closes
  const [popoverActive, setPopoverActive] = useState(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hoveringRef = useRef(false)
  const popoverOpenRef = useRef(false)

  const clearTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }, [])

  const scheduleClose = useCallback(() => {
    clearTimer()
    timeoutRef.current = setTimeout(() => {
      if (!hoveringRef.current && !popoverOpenRef.current) {
        setOpen(false)
      }
    }, 300)
  }, [clearTimer])

  const setPopoverOpen = useCallback((isOpen: boolean) => {
    popoverOpenRef.current = isOpen
    setPopoverActive(isOpen)
    if (!isOpen) {
      // Dropdown just closed — if mouse is not on sidebar, close sidebar too
      requestAnimationFrame(() => {
        if (!hoveringRef.current) {
          scheduleClose()
        }
      })
    }
  }, [scheduleClose])

  const handleEnter = useCallback(() => {
    if (isMobile) return
    hoveringRef.current = true
    clearTimer()
    setOpen(true)
  }, [isMobile, clearTimer])

  const handleLeave = useCallback(() => {
    if (isMobile) return
    hoveringRef.current = false
    // If dropdown is open, the mousemove listener handles closing
    if (popoverOpenRef.current) return
    scheduleClose()
  }, [isMobile, scheduleClose])

  // When dropdown is open, track mouse via coordinates to detect leaving both zones
  useEffect(() => {
    if (isMobile || !open || !popoverActive) return

    const onMove = (e: MouseEvent) => {
      // Use coordinate-based check — avoids DOM containment issues with portals
      const sidebarEl = document.querySelector('[data-slot="sidebar-container"]')
      const popoverEl = document.querySelector('[data-radix-popper-content-wrapper]')

      const sidebarRect = sidebarEl?.getBoundingClientRect()
      const popoverRect = popoverEl?.getBoundingClientRect()

      const inSidebar = sidebarRect &&
        e.clientX >= sidebarRect.left && e.clientX <= sidebarRect.right &&
        e.clientY >= sidebarRect.top && e.clientY <= sidebarRect.bottom

      const inPopover = popoverRect &&
        e.clientX >= popoverRect.left && e.clientX <= popoverRect.right &&
        e.clientY >= popoverRect.top && e.clientY <= popoverRect.bottom

      if (inSidebar || inPopover) {
        clearTimer()
      } else if (!timeoutRef.current) {
        // Mouse left both sidebar and dropdown — close everything
        popoverOpenRef.current = false
        hoveringRef.current = false
        setPopoverActive(false)
        timeoutRef.current = setTimeout(() => {
          setOpen(false)
        }, 300)
      }
    }

    document.addEventListener("mousemove", onMove, { passive: true })
    return () => document.removeEventListener("mousemove", onMove)
  }, [isMobile, open, popoverActive, clearTimer])

  return (
    <SidebarHoverContext.Provider value={{ setPopoverOpen }}>
      <SidebarProvider open={open} onOpenChange={setOpen}>
        <div onMouseEnter={handleEnter} onMouseLeave={handleLeave}>
          <AppSidebar />
        </div>
        <SidebarInset className="h-svh overflow-hidden bg-background">
          <AppTopbar />
          <main className="flex-1 overflow-y-scroll">
            <Outlet />
          </main>
        </SidebarInset>
      </SidebarProvider>
    </SidebarHoverContext.Provider>
  )
}
