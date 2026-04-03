import type { Platform } from "../../domain/types.js";

export interface ProductSearchParams {
  keyword: string;
  platform?: Platform;
  page?: number;
  pageSize?: number;
}

export interface ProductSearchItem {
  title: string;
  url: string;
  provider: string;
  price?: number;
  currency?: string;
  shopName?: string;
  platform?: Platform;
  platformId?: string;
  dataQuality?: "high" | "medium" | "low";
}

export interface ProductSearchResult {
  items: ProductSearchItem[];
  total: number;
  page: number;
  pageSize: number;
  provider: string;
  dataQuality: "high" | "medium" | "low";
}

export interface ProductSearchProviderConfig {
  provider: string;
  fallback?: string[];
}

export const PLATFORM_DOMAINS: Record<Platform, string[]> = {
  taobao: ["taobao.com", "tmall.com"],
  amazon: ["amazon.com", "amazon.cn"],
  douyin: ["douyin.com"],
  "1688": ["1688.com"],
  shopee: ["shopee.com", "shopee.cn"],
  pinduoduo: ["pinduoduo.com", "yangkeduo.com"],
  jd: ["jd.com", "jd.hk"],
  aliexpress: ["aliexpress.com"],
};
