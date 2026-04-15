import { useNavigate } from "react-router-dom"
import {
  FilmSlate,
  Sparkle,
  Scissors,
  MegaphoneSimple,
  ArrowRight,
} from "@phosphor-icons/react"

import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"

export function RoleSelectPage() {
  const navigate = useNavigate()

  const handleSelect = (role: "clipper" | "creator") => {
    localStorage.setItem("cr_role", role)
    if (role === "clipper") {
      navigate("/")
    } else {
      navigate("/creator/campaigns")
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
              You can switch roles anytime from the sidebar.
            </p>
          </div>
        </div>

        {/* Role cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          <RoleCard
            icon={<Scissors className="size-7" weight="duotone" />}
            title="I'm a Clipper"
            description="Browse campaigns, create short-form clips, and earn per 1,000 views."
            onSelect={() => handleSelect("clipper")}
          />
          <RoleCard
            icon={<MegaphoneSimple className="size-7" weight="duotone" />}
            title="I'm a Creator"
            description="Launch clipping campaigns, fund budgets, and review submissions."
            onSelect={() => handleSelect("creator")}
          />
        </div>

        <p className="text-center text-xs text-muted-foreground/60">
          Both roles use your Fanvue creator account. No extra setup needed.
        </p>
      </div>
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
