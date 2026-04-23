import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { queryClient } from "@/lib/query-client"
import { AuthProvider } from "@/components/auth-provider"
import { AuthGuard } from "@/components/auth-guard"
import { AppLayout } from "@/components/app-layout"
import { LoginPage } from "@/pages/login-page"
import { AuthCallbackPage } from "@/pages/auth-callback-page"
import { HubPage } from "@/pages/hub-page"
import { CampaignDetailPage } from "@/pages/campaign-detail-page"
import { CampaignBySlugPage } from "@/pages/campaign-by-slug-page"
import { MySubmissionsPage } from "@/pages/my-submissions-page"
import { WalletPage } from "@/pages/wallet-page"
import { CreatorCampaignsPage } from "@/pages/creator-campaigns-page"
import { CreateCampaignPage } from "@/pages/create-campaign-page"
import { CreatorInboxPage } from "@/pages/creator-inbox-page"
import { CreatorAnalyticsPage } from "@/pages/creator-analytics-page"
import { NotificationsPage } from "@/pages/notifications-page"
import { CampaignBudgetPage } from "@/pages/campaign-budget-page"

import { RoleSelectPage } from "@/pages/role-select-page"

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
    <TooltipProvider delayDuration={150}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="login" element={<LoginPage />} />
            <Route
              path="auth/fanvue/complete"
              element={<AuthCallbackPage />}
            />
            <Route
              path="select-role"
              element={
                <AuthGuard>
                  <RoleSelectPage />
                </AuthGuard>
              }
            />
            <Route
              element={
                <AuthGuard>
                  <AppLayout />
                </AuthGuard>
              }
            >
              <Route index element={<HubPage />} />
              <Route path="campaigns/:id" element={<CampaignDetailPage />} />
              <Route path="c/:slug" element={<CampaignBySlugPage />} />
              <Route path="submissions" element={<MySubmissionsPage />} />
              <Route path="wallet" element={<WalletPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route
                path="creator/campaigns"
                element={<CreatorCampaignsPage />}
              />
              <Route
                path="creator/campaigns/new"
                element={<CreateCampaignPage />}
              />
              <Route
                path="creator/campaigns/:id/edit"
                element={<CreateCampaignPage />}
              />
              <Route
                path="creator/campaigns/:id/budget"
                element={<CampaignBudgetPage />}
              />

              <Route path="creator/inbox" element={<CreatorInboxPage />} />
              <Route
                path="creator/analytics"
                element={<CreatorAnalyticsPage />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </TooltipProvider>
    <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  )
}
