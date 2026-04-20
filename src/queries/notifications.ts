import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import api from "@/lib/api"
import { QK } from "@/lib/query-keys"
import type { TMutationOptions, TQueryOptions } from "@/lib/query-types"

export interface Notification {
  id: string
  type:
    | "new_submission"
    | "approved"
    | "rejected"
    | "payout_released"
    | "low_budget"
    | "views_ready"
  title: string
  message: string
  createdAt: string
  read: boolean
  actionUrl?: string
}

export interface NotificationsResponse {
  notifications: Notification[]
  unreadCount: number
  meta: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
}

export function useNotifications(
  params: { page: number; limit: number },
  options?: TQueryOptions<NotificationsResponse>,
) {
  return useQuery({
    queryKey: [QK.notifications.list, params.page, params.limit] as const,
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      })
      const res = await api.get<NotificationsResponse>(
        `/notifications?${qs.toString()}`,
      )
      return res.data
    },
    ...options,
  })
}

export function useMarkNotificationRead(
  options?: TMutationOptions<unknown, string>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id) => {
      const res = await api.post(`/notifications/${id}/read`)
      return res.data
    },
    ...options,
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: [QK.notifications.list] })
      options?.onSuccess?.(...args)
    },
  })
}

export function useMarkAllNotificationsRead(options?: TMutationOptions<unknown>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const res = await api.post("/notifications/read-all")
      return res.data
    },
    ...options,
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: [QK.notifications.list] })
      options?.onSuccess?.(...args)
    },
  })
}
