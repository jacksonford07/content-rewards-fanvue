import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import api from "@/lib/api"
import { QK } from "@/lib/query-keys"
import type {
  PaginatedResponse,
  TMutationOptions,
  TQueryOptions,
} from "@/lib/query-types"
import type { Campaign } from "@/lib/types"

export interface ListCampaignsParams {
  search?: string
  platforms?: string[]
  minRate?: string
  hasBudget?: boolean
  sort?: string
  page: number
  limit: number
  payoutType?: "per_1k_views" | "per_subscriber"
}

export function useCampaigns(
  params: ListCampaignsParams,
  options?: TQueryOptions<PaginatedResponse<Campaign>>,
) {
  return useQuery({
    queryKey: [QK.campaigns.list, params] as const,
    queryFn: async () => {
      const qs = new URLSearchParams()
      if (params.search) qs.set("search", params.search)
      if (params.platforms?.length) qs.set("platforms", params.platforms.join(","))
      if (params.minRate && params.minRate !== "any") qs.set("min_rate", params.minRate)
      if (params.sort) qs.set("sort", params.sort)
      if (params.hasBudget) qs.set("has_budget", "true")
      if (params.payoutType) qs.set("payout_type", params.payoutType)
      qs.set("page", String(params.page))
      qs.set("limit", String(params.limit))
      const res = await api.get<PaginatedResponse<Campaign>>(
        `/campaigns?${qs.toString()}`,
      )
      return res.data
    },
    ...options,
  })
}

export interface MyCampaignsParams {
  search?: string
  status?: string[]
  sort?: string
  page: number
  limit: number
}

export function useMyCampaigns(
  params: MyCampaignsParams,
  options?: TQueryOptions<PaginatedResponse<Campaign>>,
) {
  return useQuery({
    queryKey: [QK.campaigns.mine, params] as const,
    queryFn: async () => {
      const qs = new URLSearchParams()
      if (params.search) qs.set("search", params.search)
      if (params.status?.length) qs.set("status", params.status.join(","))
      if (params.sort) qs.set("sort", params.sort)
      qs.set("page", String(params.page))
      qs.set("limit", String(params.limit))
      const res = await api.get<PaginatedResponse<Campaign>>(
        `/campaigns/mine?${qs.toString()}`,
      )
      return res.data
    },
    ...options,
  })
}

export interface MyCampaignsStats {
  activeCampaigns: number
  totalClippers: number
  totalViews: number
  totalSpend: number
}

export function useMyCampaignsStats(options?: TQueryOptions<MyCampaignsStats>) {
  return useQuery({
    queryKey: [QK.campaigns.mineStats] as const,
    queryFn: async () => {
      const res = await api.get<MyCampaignsStats>("/campaigns/mine/stats")
      return res.data
    },
    ...options,
  })
}

export function useCampaign(id: string | undefined, options?: TQueryOptions<Campaign>) {
  return useQuery({
    queryKey: [QK.campaigns.byId, id] as const,
    queryFn: async () => {
      const res = await api.get<Campaign>(`/campaigns/${id}`)
      return res.data
    },
    enabled: !!id,
    ...options,
  })
}

export function useCampaignBySlug(
  slug: string | undefined,
  options?: TQueryOptions<Campaign>,
) {
  return useQuery({
    queryKey: ["campaigns.bySlug", slug] as const,
    queryFn: async () => {
      const res = await api.get<Campaign>(`/campaigns/by-slug/${slug}`)
      return res.data
    },
    enabled: !!slug,
    ...options,
  })
}

export function useCampaignSourceStatus(
  id: string | undefined,
  options?: TQueryOptions<{ available: boolean }>,
) {
  return useQuery({
    queryKey: ["campaigns.sourceStatus", id] as const,
    queryFn: async () => {
      const res = await api.get<{ available: boolean }>(
        `/campaigns/${id}/source-status`,
      )
      return res.data
    },
    enabled: !!id,
    // Back off gracefully; backend already caches 5 min.
    staleTime: 60_000,
    ...options,
  })
}

export interface TopCampaign {
  id: string
  title: string
  sourceThumbnailUrl: string | null
  rewardRatePer1k: number
  totalViews: number
  totalSubmissions: number
  creator: {
    id: string
    name: string
    handle: string
    avatarUrl: string
  } | null
}

export function useTopCampaigns(
  limit = 8,
  options?: TQueryOptions<TopCampaign[]>,
) {
  return useQuery({
    queryKey: ["campaigns.top", limit] as const,
    queryFn: async () => {
      const res = await api.get<TopCampaign[]>(
        `/campaigns/top?limit=${limit}`,
      )
      return res.data
    },
    ...options,
  })
}

export interface TopClipper {
  id: string
  name: string
  handle: string
  avatarUrl: string
  earnings: number
  totalViews: number
  submissionCount: number
}

export function useTopClippers(
  limit = 8,
  options?: TQueryOptions<TopClipper[]>,
) {
  return useQuery({
    queryKey: ["campaigns.topClippers", limit] as const,
    queryFn: async () => {
      const res = await api.get<TopClipper[]>(
        `/campaigns/top-clippers?limit=${limit}`,
      )
      return res.data
    },
    ...options,
  })
}

// ─── Mutations ────────────────────────────────────────────────────────────

async function invalidateCampaignFamily(qc: ReturnType<typeof useQueryClient>) {
  // refetchType: "all" forces inactive queries to refetch too — needed so the
  // destination page (e.g. /creator/campaigns) has fresh data in cache by the
  // time the user lands there. Otherwise they briefly see the stale list.
  await Promise.all([
    qc.invalidateQueries({ queryKey: [QK.campaigns.list], refetchType: "all" }),
    qc.invalidateQueries({ queryKey: [QK.campaigns.mine], refetchType: "all" }),
    qc.invalidateQueries({
      queryKey: [QK.campaigns.mineStats],
      refetchType: "all",
    }),
    qc.invalidateQueries({
      queryKey: [QK.analytics.dashboard],
      refetchType: "all",
    }),
    qc.invalidateQueries({
      queryKey: [QK.analytics.campaigns],
      refetchType: "all",
    }),
    qc.invalidateQueries({ queryKey: [QK.campaigns.byId] }),
  ])
}

type CreateCampaignBody = Record<string, unknown>

export function useCreateCampaign(
  options?: TMutationOptions<{ id: string }, CreateCampaignBody>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body) => {
      const res = await api.post<{ id: string }>("/campaigns", body)
      return res.data
    },
    ...options,
    onSuccess: async (...args) => {
      await invalidateCampaignFamily(qc)
      options?.onSuccess?.(...args)
    },
  })
}

export function useUpdateCampaign(
  options?: TMutationOptions<unknown, { id: string; body: Record<string, unknown> }>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }) => {
      const res = await api.put(`/campaigns/${id}`, body)
      return res.data
    },
    ...options,
    onSuccess: async (...args) => {
      await invalidateCampaignFamily(qc)
      options?.onSuccess?.(...args)
    },
  })
}

export function usePauseCampaign(
  options?: TMutationOptions<{ status: string }, string>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const res = await api.post<{ status: string }>(`/campaigns/${id}/pause`)
      return res.data
    },
    ...options,
    onSuccess: async (...args) => {
      await invalidateCampaignFamily(qc)
      options?.onSuccess?.(...args)
    },
  })
}

export function useDeleteCampaign(options?: TMutationOptions<unknown, string>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const res = await api.delete(`/campaigns/${id}`)
      return res.data
    },
    ...options,
    onSuccess: async (...args) => {
      await invalidateCampaignFamily(qc)
      options?.onSuccess?.(...args)
    },
  })
}
