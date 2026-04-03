import type { ProductSearchProvider } from "../ProductSearchProvider.js";
import type { ProductSearchParams, ProductSearchResult, ProductSearchItem } from "../types.js";
import { PLATFORM_DOMAINS } from "../types.js";

const BING_SHOPPING_API_URL = "https://api.bing.microsoft.com/v7.0/custom/search";
const DEFAULT_TIMEOUT_SECONDS = 30;

function buildQuery(params: ProductSearchParams): string {
  const parts = [params.keyword];

  if (params.platform) {
    const platformDomains = PLATFORM_DOMAINS[params.platform];
    if (platformDomains?.length) {
      const siteFilter = platformDomains.map((d) => `site:${d}`).join(" OR ");
      parts.push(`(${siteFilter})`);
    }
  }

  return parts.join(" ");
}

function extractPlatformId(url: string): string | undefined {
  try {
    const parsed = new URL(url);
    const match = parsed.pathname.match(/\/item\/(\d+)/);
    if (match) return match[1];

    const idParam = parsed.searchParams.get("id");
    if (idParam) return idParam;
  } catch {}
  return undefined;
}

function detectPlatform(url: string): import("../../../domain/types.js").Platform | undefined {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    if (hostname.includes("taobao.com") || hostname.includes("tmall.com")) return "taobao";
    if (hostname.includes("amazon.com") || hostname.includes("amazon.cn")) return "amazon";
    if (hostname.includes("douyin.com")) return "douyin";
    if (hostname.includes("1688.com")) return "1688";
    if (hostname.includes("shopee")) return "shopee";
    if (hostname.includes("pinduoduo.com") || hostname.includes("yangkeduo.com"))
      return "pinduoduo";
    if (hostname.includes("jd.com") || hostname.includes("jd.hk")) return "jd";
    if (hostname.includes("aliexpress.com")) return "aliexpress";
  } catch {}
  return undefined;
}

export class BingShoppingProvider implements ProductSearchProvider {
  id = "bing";
  name = "Bing Shopping Search";

  private apiKey: string | undefined;
  private customConfigId: string | undefined;

  constructor(apiKey?: string, customConfigId?: string) {
    this.apiKey = apiKey ?? process.env.BING_API_KEY ?? process.env.BING_SEARCH_API_KEY;
    this.customConfigId = customConfigId ?? process.env.BING_CUSTOM_CONFIG_ID;
  }

  isConfigured(): boolean {
    return typeof this.apiKey === "string" && this.apiKey.length > 0;
  }

  getConfigPath(): string {
    return "plugins.entries.meichao-ecom.config.openSearch.bingApiKey";
  }

  async search(params: ProductSearchParams): Promise<ProductSearchResult> {
    if (!this.apiKey) {
      throw new Error("Bing API key not configured. Set BING_API_KEY environment variable.");
    }

    const query = buildQuery(params);
    const count = params.pageSize ?? 20;
    const offset = ((params.page ?? 1) - 1) * count;

    const url = new URL(BING_SHOPPING_API_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("count", String(count));
    url.searchParams.set("offset", String(offset));
    url.searchParams.set("responseFilter", "Webpages");
    if (this.customConfigId) {
      url.searchParams.set("customConfig", this.customConfigId);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "Ocp-Apim-Subscription-Key": this.apiKey,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(
        `Bing Shopping API error (${response.status}): ${text || response.statusText}`,
      );
    }

    const data = (await response.json()) as {
      webPages?: {
        value?: Array<{
          name?: string;
          url?: string;
          snippet?: string;
          dateLastCrawled?: string;
        }>;
        totalEstimatedMatches?: number;
      };
    };

    const rawItems = data.webPages?.value ?? [];
    const items: ProductSearchItem[] = rawItems.map((item) => ({
      title: item.name ?? "",
      url: item.url ?? "",
      provider: this.id,
      platform: detectPlatform(item.url ?? ""),
      platformId: extractPlatformId(item.url ?? ""),
      dataQuality: "medium",
    }));

    return {
      items,
      total: data.webPages?.totalEstimatedMatches ?? items.length,
      page: params.page ?? 1,
      pageSize: count,
      provider: this.id,
      dataQuality: "medium",
    };
  }
}
