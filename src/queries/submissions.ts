import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import api from "@/lib/api"
import { QK } from "@/lib/query-keys"
import type {
  PaginatedResponse,
  TMutationOptions,
  TQueryOptions,
} from "@/lib/query-types"
import type { Submission, SubmissionSnapshot } from "@/lib/types"

export type InboxTab =
  | "pending"
  | "approved"
  | "verify"
  | "paid"
  | "disputed"
  | "rejected"
  | "banned"

export interface InboxStats {
  pending: number
  approved: number
  verify: number
  paid: number
  disputed: number
  rejected: number
  banned: number
}

export type MineTab = "all" | "pending" | "approved" | "paid" | "rejected" | "banned"

export interface MineStats {
  all: number
  pending: number
  approved: number
  paid: number
  rejected: number
  banned: number
}

export function useMySubmissions(
  params: { tab: MineTab; page: number; limit: number; campaignId?: string },
  options?: TQueryOptions<PaginatedResponse<Submission>>,
) {
  return useQuery({
    queryKey: [
      QK.submissions.mine,
      params.tab,
      params.page,
      params.limit,
      params.campaignId ?? null,
    ] as const,
    queryFn: async () => {
      const qs = new URLSearchParams({
        tab: params.tab,
        page: String(params.page),
        limit: String(params.limit),
      })
      if (params.campaignId) qs.set("campaignId", params.campaignId)
      const res = await api.get<PaginatedResponse<Submission>>(
        `/submissions/mine?${qs.toString()}`,
      )
      return res.data
    },
    ...options,
  })
}

export function useMySubmissionsStats(options?: TQueryOptions<MineStats>) {
  return useQuery({
    queryKey: [QK.submissions.mine, "stats"] as const,
    queryFn: async () => {
      const res = await api.get<MineStats>("/submissions/mine/stats")
      return res.data
    },
    ...options,
  })
}

export function useInboxSubmissions(
  params: {
    tab: InboxTab
    page: number
    limit: number
    campaignId?: string
  },
  options?: TQueryOptions<PaginatedResponse<Submission>>,
) {
  return useQuery({
    queryKey: [
      QK.submissions.inbox,
      params.tab,
      params.page,
      params.limit,
      params.campaignId ?? null,
    ] as const,
    queryFn: async () => {
      const qs = new URLSearchParams({
        tab: params.tab,
        page: String(params.page),
        limit: String(params.limit),
      })
      if (params.campaignId) qs.set("campaignId", params.campaignId)
      const res = await api.get<PaginatedResponse<Submission>>(
        `/submissions/inbox?${qs.toString()}`,
      )
      return res.data
    },
    ...options,
  })
}

export function useInboxStats(
  params?: { campaignId?: string },
  options?: TQueryOptions<InboxStats>,
) {
  return useQuery({
    queryKey: [
      QK.submissions.inbox,
      "stats",
      params?.campaignId ?? null,
    ] as const,
    queryFn: async () => {
      const qs = new URLSearchParams()
      if (params?.campaignId) qs.set("campaignId", params.campaignId)
      const res = await api.get<InboxStats>(
        `/submissions/inbox/stats${qs.toString() ? `?${qs.toString()}` : ""}`,
      )
      return res.data
    },
    ...options,
  })
}

function invalidateSubmissionFamily(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: [QK.submissions.mine] })
  qc.invalidateQueries({ queryKey: [QK.submissions.inbox] })
  qc.invalidateQueries({ queryKey: [QK.submissions.byCampaign] })
  qc.invalidateQueries({ queryKey: [QK.notifications.list] })
  qc.invalidateQueries({ queryKey: [QK.analytics.dashboard] })
  qc.invalidateQueries({ queryKey: [QK.analytics.campaigns] })
}

export function useSubmitClip(
  options?: TMutationOptions<
    unknown,
    { campaignId: string; postUrl: string; platform: string }
  >,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body) => {
      const res = await api.post("/submissions", body)
      return res.data
    },
    ...options,
    onSuccess: (...args) => {
      invalidateSubmissionFamily(qc)
      qc.invalidateQueries({ queryKey: [QK.campaigns.list] })
      qc.invalidateQueries({ queryKey: [QK.campaigns.byId] })
      options?.onSuccess?.(...args)
    },
  })
}

export function useApproveSubmission(
  options?: TMutationOptions<unknown, string>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const res = await api.post(`/submissions/${id}/approve`)
      return res.data
    },
    ...options,
    onSuccess: (...args) => {
      invalidateSubmissionFamily(qc)
      options?.onSuccess?.(...args)
    },
  })
}

export function useRejectSubmission(
  options?: TMutationOptions<unknown, { id: string; reason: string }>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }) => {
      const res = await api.post(`/submissions/${id}/reject`, { reason })
      return res.data
    },
    ...options,
    onSuccess: (...args) => {
      invalidateSubmissionFamily(qc)
      options?.onSuccess?.(...args)
    },
  })
}

export function useBanSubmission(
  options?: TMutationOptions<unknown, { id: string; reason: string }>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, reason }) => {
      const res = await api.post(`/submissions/${id}/ban`, { reason })
      return res.data
    },
    ...options,
    onSuccess: (...args) => {
      invalidateSubmissionFamily(qc)
      qc.invalidateQueries({ queryKey: [QK.campaigns.list] })
      options?.onSuccess?.(...args)
    },
  })
}

export function useVerifyViews(
  options?: TMutationOptions<
    { views: number; payoutAmount: number; status: string },
    { id: string; views: number }
  >,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, views }) => {
      const res = await api.post(`/submissions/${id}/verify-views`, { views })
      return res.data
    },
    ...options,
    onSuccess: (...args) => {
      invalidateSubmissionFamily(qc)
      qc.invalidateQueries({ queryKey: [QK.auth.me] })
      qc.invalidateQueries({ queryKey: [QK.campaigns.mineStats] })
      qc.invalidateQueries({ queryKey: [QK.campaigns.byId] })
      qc.invalidateQueries({ queryKey: [QK.campaigns.list] })
      options?.onSuccess?.(...args)
    },
  })
}

export function useSubmissionSnapshots(
  id: string,
  options?: TQueryOptions<SubmissionSnapshot[]>,
) {
  return useQuery({
    queryKey: [QK.submissions.snapshots, id] as const,
    queryFn: async () => {
      const res = await api.get<SubmissionSnapshot[]>(
        `/submissions/${id}/snapshots`,
      )
      return res.data
    },
    ...options,
  })
}

export function useDevFastForward(
  options?: TMutationOptions<{ lockDate: string }, string>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const res = await api.post<{ lockDate: string }>(
        `/submissions/${id}/dev-fast-forward`,
      )
      return res.data
    },
    ...options,
    onSuccess: (...args) => {
      invalidateSubmissionFamily(qc)
      options?.onSuccess?.(...args)
    },
  })
}
