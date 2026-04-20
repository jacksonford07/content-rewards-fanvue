export const QK = {
  campaigns: {
    list: "campaigns.list",
    mine: "campaigns.mine",
    mineStats: "campaigns.mine.stats",
    byId: "campaigns.byId",
    transactions: "campaigns.transactions",
  },
  submissions: {
    mine: "submissions.mine",
    inbox: "submissions.inbox",
    byCampaign: "submissions.byCampaign",
  },
  notifications: {
    list: "notifications.list",
  },
  wallet: {
    balance: "wallet.balance",
    transactions: "wallet.transactions",
  },
  analytics: {
    dashboard: "analytics.dashboard",
    campaigns: "analytics.campaigns",
  },
  auth: {
    me: "auth.me",
  },
} as const
