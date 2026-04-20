import type {
  UseQueryOptions,
  UseMutationOptions,
} from "@tanstack/react-query"

export type TQueryOptions<TData, TError = Error> = Partial<
  UseQueryOptions<TData, TError, TData, readonly unknown[]>
>

export type TMutationOptions<TData, TVariables = void, TError = Error> = Omit<
  UseMutationOptions<TData, TError, TVariables>,
  "mutationFn"
>

export interface PaginatedResponse<T> {
  data: T[]
  meta: {
    page: number
    limit: number
    totalItems: number
    totalPages: number
  }
}
