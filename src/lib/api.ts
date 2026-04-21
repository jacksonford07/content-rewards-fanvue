import axios from "axios"

const API_BASE = import.meta.env.VITE_API_URL || ""

const api = axios.create({
  baseURL: `${API_BASE}/api`,
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("cr_token")
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || ""
    if (err.response?.status === 401 && !url.startsWith("/auth/")) {
      localStorage.removeItem("cr_token")
      if (window.location.pathname !== "/login") {
        window.location.href = "/login"
      }
    }
    return Promise.reject(err)
  },
)

export default api
