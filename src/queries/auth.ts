import { useMutation, useQueryClient } from "@tanstack/react-query"

import api from "@/lib/api"
import { queryClient } from "@/lib/query-client"
import { QK } from "@/lib/query-keys"

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
      await api.post("/auth/logout").catch(() => {})
    },
    onSettled: () => {
      qc.clear()
    },
  })
}
