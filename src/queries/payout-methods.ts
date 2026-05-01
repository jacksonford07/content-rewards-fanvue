import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import api from "@/lib/api"
import type {
  ContactChannel,
  PayoutMethod,
} from "@/lib/payout-validators"

export interface PayoutSettings {
  contactChannel: ContactChannel | null
  contactValue: string | null
  methods: { method: PayoutMethod; value: string; updatedAt: string }[]
}

const QK_PAYOUT_SETTINGS = ["payout-settings"] as const

export function usePayoutSettings() {
  return useQuery({
    queryKey: QK_PAYOUT_SETTINGS,
    queryFn: async () => {
      const res = await api.get<PayoutSettings>("/users/me/payout-methods")
      return res.data
    },
  })
}

export function useUpdatePayoutSettings() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (body: {
      methods?: { method: PayoutMethod; value: string }[]
      contactChannel?: ContactChannel | null
      contactValue?: string | null
    }) => {
      const res = await api.put<PayoutSettings>(
        "/users/me/payout-methods",
        body,
      )
      return res.data
    },
    onSuccess: (data) => {
      qc.setQueryData(QK_PAYOUT_SETTINGS, data)
    },
  })
}
