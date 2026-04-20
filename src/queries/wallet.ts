import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import api from "@/lib/api"
import { QK } from "@/lib/query-keys"
import type {
  PaginatedResponse,
  TMutationOptions,
  TQueryOptions,
} from "@/lib/query-types"

export interface WalletTransaction {
  id: string
  type: "payout" | "withdrawal" | "topup" | "escrow_lock" | "refund"
  description: string
  campaignId?: string
  amount: number
  at: string
  status: "completed" | "pending"
}

export interface WalletSummary {
  balance: number
  pendingPayouts: number
}

export function useWallet(options?: TQueryOptions<WalletSummary>) {
  return useQuery({
    queryKey: [QK.wallet.balance] as const,
    queryFn: async () => {
      const res = await api.get<WalletSummary>("/wallet")
      return res.data
    },
    ...options,
  })
}

export function useWalletTransactions(
  params: { page: number; limit: number },
  options?: TQueryOptions<PaginatedResponse<WalletTransaction>>,
) {
  return useQuery({
    queryKey: [QK.wallet.transactions, params.page, params.limit] as const,
    queryFn: async () => {
      const qs = new URLSearchParams({
        page: String(params.page),
        limit: String(params.limit),
      })
      const res = await api.get<PaginatedResponse<WalletTransaction>>(
        `/wallet/transactions?${qs.toString()}`,
      )
      return res.data
    },
    ...options,
  })
}

export function useTopup(options?: TMutationOptions<unknown, number>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (amount) => {
      const res = await api.post("/wallet/topup", { amount })
      return res.data
    },
    ...options,
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: [QK.wallet.balance] })
      qc.invalidateQueries({ queryKey: [QK.wallet.transactions] })
      qc.invalidateQueries({ queryKey: [QK.auth.me] })
      options?.onSuccess?.(...args)
    },
  })
}

export function useWithdraw(
  options?: TMutationOptions<{ transactionId?: string }, number>,
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (amount) => {
      const res = await api.post<{ transactionId?: string }>(
        "/wallet/withdraw",
        { amount },
      )
      return res.data
    },
    ...options,
    onSuccess: (...args) => {
      qc.invalidateQueries({ queryKey: [QK.wallet.balance] })
      qc.invalidateQueries({ queryKey: [QK.wallet.transactions] })
      qc.invalidateQueries({ queryKey: [QK.auth.me] })
      options?.onSuccess?.(...args)
    },
  })
}
