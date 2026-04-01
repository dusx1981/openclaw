import { initializePlatform, isPlatformInitialized } from "../application/bootstrap.js";
import { PlatformRegistry } from "../infrastructure/registry/PlatformRegistry.js";

export async function platformsCommand(): Promise<void> {
  if (!isPlatformInitialized()) {
    await initializePlatform();
  }

  const platforms = PlatformRegistry.getPlatforms();

  console.log("\n支持的平台:");
  console.log("─".repeat(50));

  for (const platform of platforms) {
    const adapter = PlatformRegistry.get(platform);
    const sourceCount = 1;
    console.log(`  ${platform}: ${sourceCount} 个数据源`);
  }

  console.log("─".repeat(50));
}
