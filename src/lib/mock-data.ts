export const platformLabels: Record<string, string> = {
  tiktok: "TikTok",
  instagram: "Instagram Reels",
  youtube: "YouTube",
  reddit: "Reddit",
  x: "X",
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(amount)
}

export function formatCompactNumber(n: number): string {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n)
}

export function timeAgo(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return "just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`
  return date.toLocaleDateString()
}

export function timeUntil(iso: string, useDays = false): string {
  const date = new Date(iso)
  const now = new Date()
  const diff = Math.floor((date.getTime() - now.getTime()) / 1000)
  if (diff <= 0) return "expired"
  if (diff < 3600) return `${Math.floor(diff / 60)}m left`
  if (diff < 86400)
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m left`
  if (useDays) {
    const days = Math.ceil(diff / 86400)
    return `${days}d left`
  }
  const hours = Math.floor(diff / 3600)
  return `${hours}h left`
}
