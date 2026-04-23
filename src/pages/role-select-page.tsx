import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  FilmSlate,
  Sparkle,
  Scissors,
  MegaphoneSimple,
  ArrowRight,
  Lock,
} from "@phosphor-icons/react"
import { toast } from "sonner"

import { Card, CardContent } from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import api from "@/lib/api"
import { useAuth } from "@/hooks/use-auth"

type Role = "clipper" | "creator"

const ROLE_COPY: Record<Role, { label: string; blurb: string }> = {
  clipper: {
    label: "Clipper",
    blurb:
      "You'll browse campaigns, post clips, and earn per 1,000 verified views.",
  },
  creator: {
    label: "Creator",
    blurb:
      "You'll launch campaigns, fund budgets in escrow, and review submissions.",
  },
}

export function RoleSelectPage() {
  const navigate = useNavigate()
  const { refresh } = useAuth()
  const [pendingRole, setPendingRole] = useState<Role | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const confirmSelect = async () => {
    if (!pendingRole) return
    setIsSubmitting(true)
    try {
      await api.patch("/users/me", { role: pendingRole })
      await refresh()
      const savedRedirect = localStorage.getItem("cr_post_login_redirect")
      if (savedRedirect) {
        localStorage.removeItem("cr_post_login_redirect")
        navigate(savedRedirect, { replace: true })
        return
      }
      navigate(pendingRole === "clipper" ? "/" : "/creator/campaigns")
    } catch {
      toast.error("Couldn't save your choice. Please try again.")
      setIsSubmitting(false)
      setPendingRole(null)
    }
  }

  return (
    <div className="flex min-h-svh items-center justify-center px-4 py-12">
      <div className="w-full max-w-lg space-y-8">
        {/* Logo */}
        <div className="flex flex-col items-center gap-3 text-center">
          <div className="relative flex size-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-primary/60 shadow-lg">
            <FilmSlate weight="fill" className="size-6 text-primary-foreground" />
            <span className="absolute -right-0.5 -top-0.5 flex size-3.5 items-center justify-center rounded-full bg-background">
              <Sparkle weight="fill" className="size-2.5 text-primary" />
            </span>
          </div>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">
              How will you use Content Rewards?
            </h1>
            <p className="mt-1.5 text-sm text-muted-foreground">
              This choice is tied to your Fanvue account and can't be changed later.
            </p>
          </div>
        </div>

        {/* Role cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <RoleCard
            icon={<Scissors className="size-7" weight="duotone" />}
            title="I'm a Clipper"
            description="Browse campaigns, create short-form clips, and earn per 1,000 views."
            onSelect={() => setPendingRole("clipper")}
          />
          <RoleCard
            icon={<MegaphoneSimple className="size-7" weight="duotone" />}
            title="I'm a Creator"
            description="Launch clipping campaigns, fund budgets, and review submissions."
            onSelect={() => setPendingRole("creator")}
          />
        </div>

        <p className="text-center text-xs text-muted-foreground/60">
          Both roles use your Fanvue creator account. No extra setup needed.
        </p>
      </div>

      <AlertDialog
        open={!!pendingRole}
        onOpenChange={(open) => {
          if (!open && !isSubmitting) setPendingRole(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-primary/10 text-primary">
              <Lock weight="fill" />
            </AlertDialogMedia>
            <AlertDialogTitle>
              Continue as{" "}
              {pendingRole ? ROLE_COPY[pendingRole].label : ""}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingRole && ROLE_COPY[pendingRole].blurb}{" "}
              <span className="mt-2 block font-medium text-foreground">
                This choice is permanent. You can't switch roles later on this
                Fanvue account.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isSubmitting}>
              Go back
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                confirmSelect()
              }}
              disabled={isSubmitting}
            >
              {isSubmitting
                ? "Saving…"
                : `Continue as ${pendingRole ? ROLE_COPY[pendingRole].label : ""}`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function RoleCard({
  icon,
  title,
  description,
  onSelect,
}: {
  icon: React.ReactNode
  title: string
  description: string
  onSelect: () => void
}) {
  return (
    <Card
      className={cn(
        "group cursor-pointer border-border/60 bg-card/80 backdrop-blur transition-all hover:border-primary/50 hover:shadow-lg hover:shadow-primary/10",
      )}
      onClick={onSelect}
    >
      <CardContent className="flex flex-col items-center gap-4 p-6 text-center">
        <div className="flex size-14 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary transition-colors group-hover:bg-primary/20">
          {icon}
        </div>
        <div>
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex items-center gap-1 text-sm font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
          Get started <ArrowRight className="size-4" />
        </div>
      </CardContent>
    </Card>
  )
}
