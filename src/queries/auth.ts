import { useMutation, useQueryClient } from "@tanstack/react-query"

import api from "@/lib/api"
import { queryClient } from "@/lib/query-client"
import { QK } from "@/lib/query-keys"
import type { AuthUser } from "@/hooks/use-auth"
import type {
  ClipperPaymentMethod,
  ContactMethod,
} from "@/lib/payment-methods"

export function invalidateAuth() {
  return queryClient.invalidateQueries({ queryKey: [QK.auth.me] })
}

export function invalidateAll() {
  return queryClient.invalidateQueries()
}

export function useLogout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      qc.clear()
    },
  })
}

export interface UpdateMeBody {
  displayName?: string
  avatarUrl?: string
  role?: "clipper" | "creator"
  contactMethod?: ContactMethod | null
  contactHandle?: string | null
  paymentMethods?: ClipperPaymentMethod[]
}

export function useUpdateMe() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: UpdateMeBody) => {
      const res = await api.patch<AuthUser>("/users/me", body)
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK.auth.me], refetchType: "all" })
    },
  })
}
