import type { ProductSearchProvider } from "../ProductSearchProvider.js";
import type { ProductSearchParams, ProductSearchResult, ProductSearchItem } from "../types.js";
import { PLATFORM_DOMAINS } from "../types.js";

export class TavilyProductProvider implements ProductSearchProvider {
  id = "tavily";
  name = "Tavily Product Search";

  private apiKey: string | undefined;

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? process.env.TAVILY_API_KEY;
  }

  isConfigured(): boolean {
    return typeof this.apiKey === "string" && this.apiKey.length > 0;
  }

  getConfigPath(): string {
    return "plugins.entries.tavily.config.webSearch.apiKey";
  }

  async search(params: ProductSearchParams): Promise<ProductSearchResult> {
    if (!this.apiKey) {
      throw new Error("Tavily API key not configured. Set TAVILY_API_KEY environment variable.");
    }

    const includeDomains = params.platform ? PLATFORM_DOMAINS[params.platform] : undefined;

    const body: Record<string, unknown> = {
      query: params.keyword,
      max_results: params.pageSize ?? 20,
      search_depth: "basic",
      include_answer: false,
    };

    if (includeDomains?.length) {
      body.include_domains = includeDomains;
    }

    const response = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Tavily API error (${response.status}): ${text || response.statusText}`);
    }

    const data = (await response.json()) as {
      results?: Array<{
        title?: string;
        url?: string;
        content?: string;
        score?: number;
      }>;
    };

    const rawItems = data.results ?? [];
    const items: ProductSearchItem[] = rawItems.map((item) => ({
      title: item.title ?? "",
      url: item.url ?? "",
      provider: this.id,
      dataQuality: "medium",
    }));

    const offset = ((params.page ?? 1) - 1) * (params.pageSize ?? 20);

    return {
      items,
      total: items.length,
      page: params.page ?? 1,
      pageSize: params.pageSize ?? 20,
      provider: this.id,
      dataQuality: "medium",
    };
  }
}
