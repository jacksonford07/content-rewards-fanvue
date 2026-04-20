import { QueryClient } from "@tanstack/react-query"

const FIFTEEN_MINUTES = 15 * 60 * 1000

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: FIFTEEN_MINUTES,
      gcTime: FIFTEEN_MINUTES * 2,
      retry: 0,
      refetchOnWindowFocus: false,
    },
  },
})
