import type { Platform } from "../domain/types.js";
import {
  ValidatorRegistry,
  type ValidationOptions,
  ValidationReport,
} from "../validation/index.js";

export interface ValidateCommandOptions {
  platform?: string;
  count?: number;
  json?: boolean;
  maskSensitive?: boolean;
  all?: boolean;
}

export async function validateCommand(options: ValidateCommandOptions): Promise<void> {
  const count = options.count ?? 10;

  if (options.all) {
    await validateAllPlatforms({
      count,
      json: options.json,
      maskSensitive: options.maskSensitive,
    });
    return;
  }

  if (!options.platform) {
    console.error("Error: Platform is required. Use --all to validate all platforms.");
    console.error("Available platforms:", ValidatorRegistry.getAllPlatforms().join(", "));
    process.exit(1);
  }

  const platform = options.platform.toLowerCase() as Platform;

  if (!ValidatorRegistry.has(platform)) {
    console.error(`Error: Unknown platform "${platform}"`);
    console.error("Available platforms:", ValidatorRegistry.getAllPlatforms().join(", "));
    process.exit(1);
  }

  const validator = ValidatorRegistry.get(platform)!;
  const validationOptions: ValidationOptions = {
    count,
    maskSensitive: options.maskSensitive ?? false,
  };

  console.log(`Validating ${platform} with ${count} requests...\n`);

  const result = await validator.validate(validationOptions);
  const report = ValidationReport.fromResult(result);

  if (options.json) {
    console.log(report.toJSON(options.maskSensitive));
  } else {
    console.log(report.toText(options.maskSensitive));
  }
}

async function validateAllPlatforms(options: {
  count: number;
  json?: boolean;
  maskSensitive?: boolean;
}): Promise<void> {
  const platforms = ValidatorRegistry.getAllPlatforms();
  console.log(`Validating all platforms: ${platforms.join(", ")}\n`);

  const results: Array<{ platform: Platform; report: ValidationReport }> = [];

  for (const platform of platforms) {
    const validator = ValidatorRegistry.get(platform)!;
    const validationOptions: ValidationOptions = {
      count: options.count,
      maskSensitive: options.maskSensitive ?? false,
    };

    console.log(`\n${"=".repeat(60)}`);
    console.log(`Validating ${platform}...`);

    const result = await validator.validate(validationOptions);
    const report = ValidationReport.fromResult(result);
    results.push({ platform, report });

    if (!options.json) {
      console.log(report.toText(options.maskSensitive));
    }
  }

  if (options.json) {
    console.log(
      JSON.stringify(
        results.map((r) => JSON.parse(r.report.toJSON(options.maskSensitive ?? false))),
        null,
        2,
      ),
    );
  }

  console.log("\n" + "=".repeat(60));
  console.log("Summary:");
  for (const { platform, report } of results) {
    const result = JSON.parse(report.toJSON(false));
    console.log(`- ${platform}: ${result.stats.successRate.toFixed(2)}% success rate`);
  }
}
