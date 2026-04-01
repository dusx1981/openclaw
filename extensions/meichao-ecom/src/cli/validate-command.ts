import {
  initializePlatform,
  getValidatorRegistry,
  isPlatformInitialized,
} from "../application/bootstrap.js";
import type { Platform } from "../domain/types.js";
import { PlatformRegistry } from "../infrastructure/registry/PlatformRegistry.js";

export interface ValidateCommandOptions {
  count?: number;
  all?: boolean;
  json?: boolean;
}

export async function validateCommand(
  platform: string | undefined,
  opts: ValidateCommandOptions,
): Promise<void> {
  if (!isPlatformInitialized()) {
    await initializePlatform();
  }

  const count = Math.min(opts.count ?? 10, 100);
  const supportedPlatforms = PlatformRegistry.getPlatforms();

  if (opts.all) {
    await validateAllPlatforms(supportedPlatforms, count, opts.json);
    return;
  }

  if (!platform) {
    console.error("请指定平台或使用 --all 验证所有平台");
    process.exit(1);
  }

  if (!supportedPlatforms.includes(platform as Platform)) {
    console.error(`不支持的平台: ${platform}`);
    console.error(`支持的平台: ${supportedPlatforms.join(", ")}`);
    process.exit(1);
  }

  try {
    const registry = getValidatorRegistry();
    const validator = registry.getValidator(platform);

    if (!validator) {
      console.error(`平台 ${platform} 没有注册验证器`);
      process.exit(1);
    }

    const report = await validator.validate(count);

    if (opts.json) {
      console.log(JSON.stringify(report, null, 2));
    } else {
      printValidationReport(report, platform);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`验证平台失败: ${message}`);
    process.exit(1);
  }
}

async function validateAllPlatforms(
  platforms: Platform[],
  count: number,
  json?: boolean,
): Promise<void> {
  const results: Record<string, unknown> = {};

  for (const platform of platforms) {
    try {
      const registry = getValidatorRegistry();
      const validator = registry.getValidator(platform);
      if (validator) {
        results[platform] = await validator.validate(count);
      }
    } catch (error) {
      results[platform] = { error: error instanceof Error ? error.message : String(error) };
    }
  }

  if (json) {
    console.log(JSON.stringify(results, null, 2));
  } else {
    console.log("\n平台验证报告:");
    console.log("─".repeat(60));

    for (const [platform, report] of Object.entries(results)) {
      const r = report as Record<string, unknown>;
      console.log(`\n${platform}:`);
      if (r.error) {
        console.log(`  错误: ${r.error}`);
      } else {
        const stats = r.stats as Record<string, unknown> | undefined;
        console.log(`  成功率: ${((stats?.successRate as number) ?? 0) * 100}%`);
        console.log(`  请求次数: ${(stats?.totalRequests as number) ?? 0}`);
        console.log(`  成功次数: ${(stats?.successfulRequests as number) ?? 0}`);
        console.log(`  失败次数: ${(stats?.failedRequests as number) ?? 0}`);
      }
    }

    console.log("\n" + "─".repeat(60));
  }
}

function printValidationReport(report: unknown, platform: string): void {
  const r = report as Record<string, unknown>;
  const stats = r?.stats as Record<string, unknown> | undefined;

  console.log(`\n${platform} 平台验证报告:`);
  console.log("─".repeat(50));
  console.log(`成功率: ${((stats?.successRate as number) ?? 0) * 100}%`);
  console.log(`请求次数: ${(stats?.totalRequests as number) ?? 0}`);
  console.log(`成功次数: ${(stats?.successfulRequests as number) ?? 0}`);
  console.log(`失败次数: ${(stats?.failedRequests as number) ?? 0}`);

  if (r?.degradation) {
    console.log("\n降级信息:");
    const d = r.degradation as Record<string, unknown>;
    console.log(`  降级次数: ${d?.count ?? 0}`);
    console.log(`  降级路径: ${JSON.stringify(d?.paths ?? [])}`);
  }

  if (r?.samples && Array.isArray(r.samples) && r.samples.length > 0) {
    console.log("\n样本数据:");
    for (let i = 0; i < Math.min(3, r.samples.length); i++) {
      const sample = r.samples[i] as Record<string, unknown>;
      console.log(
        `  [${i + 1}] ID: ${sample?.productId ?? "未知"}, 来源: ${sample?.source ?? "未知"}`,
      );
    }
  }

  console.log("─".repeat(50));
}
