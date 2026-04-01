import { Type } from "@sinclair/typebox";
import type { OpenClawPluginApi } from "../../runtime-api.js";
import { initializePlatform, isPlatformInitialized } from "../application/bootstrap.js";
import type { Platform } from "../domain/types.js";
import { PlatformRegistry } from "../infrastructure/registry/PlatformRegistry.js";
import type { ValidationResult } from "../validation/PlatformValidator.js";
import { ValidatorRegistry } from "../validation/ValidatorRegistry.js";

const PLATFORMS = [
  "taobao",
  "amazon",
  "douyin",
  "1688",
  "shopee",
  "pinduoduo",
  "jd",
  "aliexpress",
] as const;

export function createValidatePlatformTool(api: OpenClawPluginApi) {
  return {
    name: "ecom-validate-platform",
    label: "E-commerce Platform Validation",
    description:
      "Validate data collection capability for an e-commerce platform. Use to check API health, source availability, and fallback paths before bulk operations. Returns success rate, per-source stats, degradation history, and sample products. Validates single platform or all platforms when platform not specified.",
    parameters: Type.Object({
      platform: Type.Optional(
        Type.String({
          description: `Platform to validate. If not specified, validates all registered platforms. Supported: ${PLATFORMS.join(", ")}`,
        }),
      ),
      count: Type.Optional(
        Type.Number({
          description: "Number of validation requests (default 10, max 100)",
          minimum: 1,
          maximum: 100,
        }),
      ),
    }),
    async execute(_id: string, params: Record<string, unknown>) {
      const platform = typeof params.platform === "string" ? params.platform.trim() : undefined;
      const countRaw = typeof params.count === "number" ? params.count : 10;
      const count = Math.min(Math.max(1, countRaw), 100);

      if (!isPlatformInitialized()) {
        await initializePlatform();
      }

      const logger = api.logger;

      if (platform) {
        const supportedPlatforms = PlatformRegistry.getPlatforms();
        if (!supportedPlatforms.includes(platform as Platform)) {
          throw new Error(
            `Unsupported platform: ${platform}. Supported platforms: ${supportedPlatforms.join(", ")}`,
          );
        }

        logger?.info?.(`Validating platform ${platform} with ${count} requests`);

        const validator = ValidatorRegistry.get(platform as Platform);
        if (!validator) {
          throw new Error(`No validator registered for platform: ${platform}`);
        }

        try {
          const result = await validator.validate({ count, maskSensitive: true });
          return formatValidationResult(result, logger);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          logger?.error?.(`Validation failed for ${platform}: ${message}`);
          throw new Error(`Failed to validate platform ${platform}: ${message}`);
        }
      }

      const allPlatforms = ValidatorRegistry.getAllPlatforms();
      logger?.info?.(
        `Validating all platforms (${allPlatforms.length}) with ${count} requests each`,
      );

      const results: ValidationResult[] = [];
      for (const p of allPlatforms) {
        const validator = ValidatorRegistry.get(p);
        if (!validator) continue;

        try {
          const result = await validator.validate({ count, maskSensitive: true });
          results.push(result);
        } catch (error) {
          logger?.error?.(
            `Validation failed for ${p}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }

      return formatMultiValidationResults(results, logger);
    },
  };
}

function formatValidationResult(result: ValidationResult, logger: unknown) {
  const log = logger as { info?: (msg: string) => void };
  log?.info?.(
    `Validation complete for ${result.platform}: ${result.stats.successRate.toFixed(1)}% success`,
  );

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            validation: {
              platform: result.platform,
              timestamp: result.timestamp,
              durationMs: result.duration,
            },
            stats: {
              total: result.stats.total,
              successes: result.stats.successes,
              failures: result.stats.failures,
              successRate: result.stats.successRate.toFixed(2),
              perSource: result.stats.perSourceStats.map((s) => ({
                sourceId: s.sourceId,
                sourceType: s.sourceType,
                successRate: s.successRate.toFixed(2),
              })),
              failureReasons: result.stats.failureReasons,
            },
            degradation: {
              totalFallbacks: result.degradation.totalFallbacks,
              paths: result.degradation.paths,
            },
            samples: result.samples.map((s) => ({
              productId: s.productId,
              title: s.title,
              price: s.price,
              currency: s.currency,
              source: s.source,
            })),
          },
          null,
          2,
        ),
      },
    ],
  };
}

function formatMultiValidationResults(results: ValidationResult[], logger: unknown) {
  const log = logger as { info?: (msg: string) => void };
  log?.info?.(`Validated ${results.length} platforms`);

  const summary = results.map((r) => ({
    platform: r.platform,
    successRate: r.stats.successRate.toFixed(2),
    total: r.stats.total,
    successes: r.stats.successes,
    failures: r.stats.failures,
    durationMs: r.duration,
  }));

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(
          {
            success: true,
            validation: {
              platformsValidated: results.length,
              timestamp: Date.now(),
            },
            summary,
            details: results.map((r) => ({
              platform: r.platform,
              stats: {
                total: r.stats.total,
                successes: r.stats.successes,
                failures: r.stats.failures,
                successRate: r.stats.successRate.toFixed(2),
              },
              degradation: {
                totalFallbacks: r.degradation.totalFallbacks,
              },
              samples: r.samples.length,
            })),
          },
          null,
          2,
        ),
      },
    ],
  };
}
