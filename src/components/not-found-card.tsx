import { Link } from "react-router-dom"
import { ArrowLeft, MagnifyingGlass } from "@phosphor-icons/react"

import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"

interface NotFoundCardProps {
  title?: string
  description?: string
  backTo: string
  backLabel?: string
}

export function NotFoundCard({
  title = "Can't load this page",
  description = "The link may be outdated, or the resource has been removed or is no longer available.",
  backTo,
  backLabel = "Go back",
}: NotFoundCardProps) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-10 md:px-6 md:py-16">
      <Card className="flex flex-col items-center gap-3 p-10 text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <MagnifyingGlass className="size-5 text-muted-foreground" />
        </div>
        <h1 className="text-lg font-semibold">{title}</h1>
        <p className="max-w-md text-sm text-muted-foreground">{description}</p>
        <Button asChild variant="outline" className="mt-2">
          <Link to={backTo}>
            <ArrowLeft className="size-4" />
            {backLabel}
          </Link>
        </Button>
      </Card>
    </div>
  )
}
