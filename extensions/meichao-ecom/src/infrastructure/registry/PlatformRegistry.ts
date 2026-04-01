import type { PlatformGateway } from "../../domain/ports/PlatformGateway.js";
import type { Platform } from "../../domain/types.js";

export interface RegistryStats {
  registeredPlatforms: number;
  platforms: Platform[];
  healthyPlatforms: Platform[];
  unhealthyPlatforms: Platform[];
}

class PlatformRegistryImpl {
  private adapters: Map<Platform, PlatformGateway> = new Map();
  private healthStatus: Map<Platform, boolean> = new Map();

  register(adapter: PlatformGateway): void {
    const platform = adapter.getPlatform();
    if (this.adapters.has(platform)) {
      console.warn(`Platform ${platform} already registered, overwriting`);
    }
    this.adapters.set(platform, adapter);
    this.healthStatus.set(platform, true);
  }

  unregister(platform: Platform): boolean {
    this.healthStatus.delete(platform);
    return this.adapters.delete(platform);
  }

  get(platform: Platform): PlatformGateway | undefined {
    return this.adapters.get(platform);
  }

  has(platform: Platform): boolean {
    return this.adapters.has(platform);
  }

  getAll(): Map<Platform, PlatformGateway> {
    return new Map(this.adapters);
  }

  getPlatforms(): Platform[] {
    return Array.from(this.adapters.keys());
  }

  async updateHealth(platform: Platform, isHealthy: boolean): Promise<void> {
    this.healthStatus.set(platform, isHealthy);
  }

  async getHealth(platform: Platform): Promise<boolean> {
    return this.healthStatus.get(platform) ?? false;
  }

  async checkAllHealth(): Promise<Map<Platform, boolean>> {
    const results = new Map<Platform, boolean>();

    for (const [platform, adapter] of this.adapters) {
      try {
        const health = await adapter.healthCheck();
        results.set(platform, health.isHealthy);
        this.healthStatus.set(platform, health.isHealthy);
      } catch {
        results.set(platform, false);
        this.healthStatus.set(platform, false);
      }
    }

    return results;
  }

  async getStats(): Promise<RegistryStats> {
    const platforms = this.getPlatforms();
    const healthMap = await this.checkAllHealth();

    const healthyPlatforms = platforms.filter((p) => healthMap.get(p) === true);
    const unhealthyPlatforms = platforms.filter((p) => healthMap.get(p) === false);

    return {
      registeredPlatforms: platforms.length,
      platforms,
      healthyPlatforms,
      unhealthyPlatforms,
    };
  }

  clear(): void {
    this.adapters.clear();
    this.healthStatus.clear();
  }
}

export const PlatformRegistry = new PlatformRegistryImpl();
