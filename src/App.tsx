import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom"

import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { AppLayout } from "@/components/app-layout"
import { LoginPage } from "@/pages/login-page"
import { HubPage } from "@/pages/hub-page"
import { CampaignDetailPage } from "@/pages/campaign-detail-page"
import { MySubmissionsPage } from "@/pages/my-submissions-page"
import { WalletPage } from "@/pages/wallet-page"
import { CreatorCampaignsPage } from "@/pages/creator-campaigns-page"
import { CreateCampaignPage } from "@/pages/create-campaign-page"
import { CreatorInboxPage } from "@/pages/creator-inbox-page"
import { CreatorAnalyticsPage } from "@/pages/creator-analytics-page"
import { NotificationsPage } from "@/pages/notifications-page"
import { CampaignBudgetPage } from "@/pages/campaign-budget-page"
import { KycPage } from "@/pages/kyc-page"

export default function App() {
  return (
    <TooltipProvider delayDuration={150}>
      <BrowserRouter>
        <Routes>
          <Route path="login" element={<LoginPage />} />
          <Route element={<AppLayout />}>
            <Route index element={<HubPage />} />
            <Route path="campaigns/:id" element={<CampaignDetailPage />} />
            <Route path="submissions" element={<MySubmissionsPage />} />
            <Route path="wallet" element={<WalletPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="creator/campaigns" element={<CreatorCampaignsPage />} />
            <Route path="creator/campaigns/new" element={<CreateCampaignPage />} />
            <Route
              path="creator/campaigns/:id/edit"
              element={<CreateCampaignPage />}
            />
            <Route
              path="creator/campaigns/:id/budget"
              element={<CampaignBudgetPage />}
            />
            <Route path="kyc" element={<KycPage />} />
            <Route path="creator/inbox" element={<CreatorInboxPage />} />
            <Route path="creator/analytics" element={<CreatorAnalyticsPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Route>
        </Routes>
      </BrowserRouter>
      <Toaster richColors position="top-right" />
    </TooltipProvider>
  )
}
