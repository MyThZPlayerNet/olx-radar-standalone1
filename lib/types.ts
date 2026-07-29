export type SellerType = "all" | "private" | "business";
export type Platform = "olx" | "vinted";

export type RadarSearch = {
  categoryId: number;
  conditions: string[];
  deliveryRequired: boolean;
  excludeKeywords: string[];
  id: string;
  includeKeywords: string[];
  locations: string[];
  matchAllKeywords: boolean;
  maxAgeMinutes: number;
  maxPrice: number | null;
  minPrice: number | null;
  name: string;
  query: string;
  sellerType: SellerType;
  skipPromoted: boolean;
  sourceUrl: string;
  webhookConfigured: boolean;
};

export type RadarConfig = RadarSearch & {
  active: boolean;
  discordAvatarUrl: string;
  discordColor: number;
  discordRoleId: string;
  discordUsername: string;
  intervalSeconds: number;
  platform: Platform;
  searches: RadarSearch[];
  webhookConfigured: boolean;
};

export type RadarStatus = {
  active: boolean;
  initialized: boolean;
  lastCheckAt: string | null;
  lastError: string | null;
  lastFetched: number;
  lastMatched: number;
  lastSent: number;
  nextCheckAt: string | null;
  webhookConfigured: boolean;
};

export type PublicOffer = {
  condition: string;
  createdAt: string;
  delivery: boolean;
  id: string;
  imageUrl: string;
  location: string;
  price: number | null;
  priceLabel: string;
  promoted: boolean;
  sellerType: "private" | "business";
  title: string;
  url: string;
};

export type ConfigInput = Omit<RadarConfig, "active" | "webhookConfigured"> & {
  removeWebhook?: boolean;
  webhookSearchId?: string;
  webhookUrl?: string;
};

export type RadarRow = {
  active: number;
  category_id: number;
  conditions: string;
  delivery_required: number;
  discord_avatar_url: string;
  discord_color: number;
  discord_role_id: string;
  discord_username: string;
  exclude_keywords: string;
  include_keywords: string;
  initialized: number;
  interval_seconds: number;
  last_check_at: string | null;
  last_error: string | null;
  last_fetched: number;
  last_matched: number;
  last_sent: number;
  locations: string;
  match_all_keywords: number;
  max_age_minutes: number;
  max_price: number | null;
  min_price: number | null;
  name: string;
  next_check_at: string | null;
  owner_username: string;
  platform: Platform;
  query: string;
  seller_type: SellerType;
  search_webhooks: string;
  searches: string;
  skip_promoted: number;
  source_url: string;
  webhook_ciphertext: string | null;
  webhook_iv: string | null;
};

export type Account = {
  createdAt: string;
  displayName: string;
  lastLoginAt: string | null;
  mustChangePassword: boolean;
  role: "admin" | "user";
  username: string;
};

export type AdminRadarOverview = {
  config: RadarConfig;
  status: RadarStatus;
};

export type AdminAccountOverview = Account & {
  radars: Partial<Record<Platform, AdminRadarOverview>>;
};
