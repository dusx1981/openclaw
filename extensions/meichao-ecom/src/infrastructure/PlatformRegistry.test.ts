import { describe, it, expect, beforeEach } from "vitest";
import { MockPlatformGateway } from "./adapters/MockPlatformGateway.js";
import { PlatformRegistry } from "./registry/PlatformRegistry.js";

describe("PlatformRegistry", () => {
  beforeEach(() => {
    PlatformRegistry.clear();
  });

  describe("register", () => {
    it("should register a platform adapter", () => {
      const adapter = new MockPlatformGateway("taobao");
      PlatformRegistry.register(adapter);

      expect(PlatformRegistry.has("taobao")).toBe(true);
    });

    it("should overwrite existing adapter", () => {
      const adapter1 = new MockPlatformGateway("taobao");
      const adapter2 = new MockPlatformGateway("taobao");

      PlatformRegistry.register(adapter1);
      PlatformRegistry.register(adapter2);

      expect(PlatformRegistry.get("taobao")).toBe(adapter2);
    });
  });

  describe("unregister", () => {
    it("should unregister a platform adapter", () => {
      const adapter = new MockPlatformGateway("taobao");
      PlatformRegistry.register(adapter);

      const result = PlatformRegistry.unregister("taobao");

      expect(result).toBe(true);
      expect(PlatformRegistry.has("taobao")).toBe(false);
    });

    it("should return false if platform not registered", () => {
      const result = PlatformRegistry.unregister("nonexistent" as "taobao");

      expect(result).toBe(false);
    });
  });

  describe("get", () => {
    it("should return registered adapter", () => {
      const adapter = new MockPlatformGateway("taobao");
      PlatformRegistry.register(adapter);

      expect(PlatformRegistry.get("taobao")).toBe(adapter);
    });

    it("should return undefined if not registered", () => {
      expect(PlatformRegistry.get("nonexistent" as "taobao")).toBeUndefined();
    });
  });

  describe("has", () => {
    it("should return true if registered", () => {
      const adapter = new MockPlatformGateway("taobao");
      PlatformRegistry.register(adapter);

      expect(PlatformRegistry.has("taobao")).toBe(true);
    });

    it("should return false if not registered", () => {
      expect(PlatformRegistry.has("nonexistent" as "taobao")).toBe(false);
    });
  });

  describe("getPlatforms", () => {
    it("should return all registered platforms", () => {
      PlatformRegistry.register(new MockPlatformGateway("taobao"));
      PlatformRegistry.register(new MockPlatformGateway("amazon"));

      const platforms = PlatformRegistry.getPlatforms();

      expect(platforms).toContain("taobao");
      expect(platforms).toContain("amazon");
      expect(platforms).toHaveLength(2);
    });

    it("should return empty array if no platforms", () => {
      expect(PlatformRegistry.getPlatforms()).toHaveLength(0);
    });
  });

  describe("checkAllHealth", () => {
    it("should return health status for all platforms", async () => {
      const taobaoAdapter = new MockPlatformGateway("taobao");
      const amazonAdapter = new MockPlatformGateway("amazon");
      amazonAdapter.setHealthy(false);

      PlatformRegistry.register(taobaoAdapter);
      PlatformRegistry.register(amazonAdapter);

      const health = await PlatformRegistry.checkAllHealth();

      expect(health.get("taobao")).toBe(true);
      expect(health.get("amazon")).toBe(false);
    });
  });

  describe("getStats", () => {
    it("should return registry statistics", async () => {
      const taobaoAdapter = new MockPlatformGateway("taobao");
      const amazonAdapter = new MockPlatformGateway("amazon");
      amazonAdapter.setHealthy(false);

      PlatformRegistry.register(taobaoAdapter);
      PlatformRegistry.register(amazonAdapter);

      const stats = await PlatformRegistry.getStats();

      expect(stats.registeredPlatforms).toBe(2);
      expect(stats.platforms).toContain("taobao");
      expect(stats.platforms).toContain("amazon");
      expect(stats.healthyPlatforms).toContain("taobao");
      expect(stats.unhealthyPlatforms).toContain("amazon");
    });
  });

  describe("clear", () => {
    it("should clear all registered adapters", () => {
      PlatformRegistry.register(new MockPlatformGateway("taobao"));
      PlatformRegistry.register(new MockPlatformGateway("amazon"));

      PlatformRegistry.clear();

      expect(PlatformRegistry.getPlatforms()).toHaveLength(0);
    });
  });
});
