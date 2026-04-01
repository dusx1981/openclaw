import {
  initializePlatform,
  getFetchProductUseCase,
  isPlatformInitialized,
} from "../application/bootstrap.js";
import type { Platform } from "../domain/types.js";
import { PlatformRegistry } from "../infrastructure/registry/PlatformRegistry.js";

export interface FetchCommandOptions {
  json?: boolean;
}

export async function fetchCommand(
  platform: string,
  productId: string,
  opts: FetchCommandOptions,
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

  try {
    const useCase = getFetchProductUseCase(platform);
    const result = await useCase.execute(platform as Platform, productId);

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
    } else {
      printProductTable(result);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`获取商品失败: ${message}`);
    process.exit(1);
  }
}

function printProductTable(product: unknown): void {
  const p = product as Record<string, unknown>;
  console.log("\n商品信息:");
  console.log("─".repeat(50));
  console.log(`平台: ${p?.platform ?? "未知"}`);
  console.log(`商品ID: ${p?.platformId ?? p?.id ?? "未知"}`);
  console.log(`标题: ${p?.title ?? "未知"}`);
  console.log(`价格: ${p?.price ?? "未知"} ${p?.currency ?? ""}`);
  if (p?.originalPrice) {
    console.log(`原价: ${p.originalPrice}`);
  }
  console.log(`销量: ${p?.sales ?? "未知"}`);
  if (p?.rating) {
    console.log(`评分: ${p.rating}`);
  }
  if (p?.shopName) {
    console.log(`店铺: ${p.shopName}`);
  }
  console.log(`来源: ${p?.sourceUrl ?? "未知"}`);
  console.log("─".repeat(50));
}
