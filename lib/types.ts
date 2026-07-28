export type SellerType = "all" | "private" | "business";

export type RadarConfig = {
  active: boolean;
  categoryId: number;
  conditions: string[];
  deliveryRequired: boolean;
  discordAvatarUrl: string;
  discordColor: number;
  discordRoleId: string;
  discordUsername: string;
  excludeKeywords: string[];
  includeKeywords: string[];
  intervalSeconds: number;
  locations: string[];
  matchAllKeywords: boolean;
  maxAgeMinutes: number;
  maxPrice: number | null;
  minPrice: number | null;
  name: string;
  olxUrl: string;
  query: string;
  sellerType: SellerType;
  skipPromoted: boolean;
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
  olx_url: string;
  owner_username: string;
  query: string;
  seller_type: SellerType;
  skip_promoted: number;
  webhook_ciphertext: string | null;
  webhook_iv: string | null;
};

export type Account = {
  createdAt: string;
  displayName: string;
  mustChangePassword: boolean;
  role: "admin" | "user";
  username: string;
};
