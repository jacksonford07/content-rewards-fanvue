import { useQuery } from "@tanstack/react-query"

import api from "@/lib/api"
import { QK } from "@/lib/query-keys"
import type { PaginatedResponse, TQueryOptions } from "@/lib/query-types"

export interface DashboardData {
  totalViews: number
  totalSpend: number
  totalClippers: number
  averageCpm: number
  activeCampaigns: number
  totalSubmissions: number
  campaignTitle: string | null
}

export interface CampaignBreakdown {
  id: string
  title: string
  sourceThumbnailUrl: string
  totalViews: number
  activeClippers: number
  budgetSpent: number
  totalBudget: number
}

export function useDashboard(
  campaignId?: string,
  options?: TQueryOptions<DashboardData>,
) {
  return useQuery({
    queryKey: [QK.analytics.dashboard, campaignId ?? null] as const,
    queryFn: async () => {
      const url = campaignId
        ? `/analytics/dashboard?campaignId=${campaignId}`
        : "/analytics/dashboard"
      const res = await api.get<DashboardData>(url)
      return res.data
    },
    ...options,
  })
}

export function useCampaignBreakdown(
  params: { page: number; limit: number; enabled?: boolean },
  options?: TQueryOptions<PaginatedResponse<CampaignBreakdown>>,
) {
  return useQuery({
    queryKey: [QK.analytics.campaigns, params.page, params.limit] as const,
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      })
      const res = await api.get<PaginatedResponse<CampaignBreakdown>>(
        `/analytics/campaigns?${qs.toString()}`,
      )
      return res.data
    },
    enabled: params.enabled ?? true,
    ...options,
  })
}
