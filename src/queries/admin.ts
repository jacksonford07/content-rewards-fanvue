import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import api from "@/lib/api"

export interface DisputeRow {
  id: string
  submissionId: string
  amountCents: number
  method: string
  valueSnapshot: string
  reference: string | null
  txHash: string | null
  createdAt: string
  disputedAt: string | null
  disputeReason: string | null
  disputeResolvedAt: string | null
  disputeResolution: "confirmed" | "rejected" | null
  creator: { id: string; displayName: string; handle: string }
  clipper: {
    id: string
    displayName: string
    handle: string
    contactChannel: string | null
    contactValue: string | null
  }
  campaign: { id: string; title: string }
  postUrl: string
}

const QK = ["admin.disputes"] as const

export function useDisputes(filter: "open" | "resolved" | "all" = "open") {
  return useQuery({
    queryKey: [...QK, filter] as const,
    queryFn: async () => {
      const res = await api.get<DisputeRow[]>(
        `/admin/disputes?filter=${filter}`,
      )
      return res.data
    },
  })
}

export function useResolveDispute() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      resolution,
    }: {
      id: string
      resolution: "confirmed" | "rejected"
    }) => {
      const res = await api.post(`/admin/disputes/${id}/resolve`, {
        resolution,
      })
      return res.data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QK })
    },
  })
}
