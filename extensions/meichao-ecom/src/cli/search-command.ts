import {
  initializePlatform,
  getSearchProductsUseCase,
  isPlatformInitialized,
} from "../application/bootstrap.js";
import type { Platform } from "../domain/types.js";
import { PlatformRegistry } from "../infrastructure/registry/PlatformRegistry.js";

export interface SearchCommandOptions {
  limit?: number;
  json?: boolean;
}

export async function searchCommand(
  platform: string,
  keyword: string,
  opts: SearchCommandOptions,
): Promise<void> {
  if (!isPlatformInitialized()) {
    await initializePlatform();
  }

  const supportedPlatforms = PlatformRegistry.getPlatforms();
  if (!supportedPlatforms.includes(platform as Platform)) {
    console.error(`不支持的平台: ${platform}`);
    console.error(`支持的平台: ${supportedPlatforms.join(", ")}`);
    process.exit(1);
  }

  const limit = Math.min(opts.limit ?? 50, 100);

  try {
    const useCase = getSearchProductsUseCase(platform);
    const result = await useCase.execute(platform as Platform, keyword, { pageSize: limit });

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printSearchResults(result.products, keyword);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`搜索商品失败: ${message}`);
    process.exit(1);
  }
}

function printSearchResults(results: unknown[], keyword: string): void {
  console.log(`\n搜索 "${keyword}" 结果 (共 ${results.length} 条):`);
  console.log("─".repeat(80));

  if (results.length === 0) {
    console.log("未找到匹配的商品");
    return;
  }

  for (const item of results) {
    const p = item as Record<string, unknown>;
    console.log(`\n[${p?.platformId ?? p?.id ?? "未知ID"}]`);
    console.log(`  标题: ${truncate(String(p?.title ?? "未知"), 50)}`);
    console.log(`  价格: ${p?.price ?? "未知"} ${p?.currency ?? ""}`);
    console.log(`  销量: ${p?.sales ?? "未知"}`);
  }

  console.log("\n" + "─".repeat(80));
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}
