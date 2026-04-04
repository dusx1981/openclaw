import { describe, it, expect } from "vitest";

describe("Plugin Entry Point", () => {
  describe("exports", () => {
    it("should export default plugin definition", async () => {
      const mod = await import("../index.js");
      expect(mod.default).toBeDefined();
      expect(mod.default.id).toBe("meichao-ecom");
      expect(mod.default.name).toBe("Meichao E-commerce");
    });

    it("should have register function in plugin definition", async () => {
      const mod = await import("../index.js");
      expect(typeof mod.default.register).toBe("function");
    });
  });

  describe("runtime-api exports", () => {
    it("should export initializePlatform from runtime-api", async () => {
      const mod = await import("../runtime-api.js");
      expect(typeof mod.initializePlatform).toBe("function");
    });

    it("should export shutdownPlatform from runtime-api", async () => {
      const mod = await import("../runtime-api.js");
      expect(typeof mod.shutdownPlatform).toBe("function");
    });

    it("should export PlatformRegistry from runtime-api", async () => {
      const mod = await import("../runtime-api.js");
      expect(mod.PlatformRegistry).toBeDefined();
      expect(typeof mod.PlatformRegistry.getPlatforms).toBe("function");
    });

    it("should export CLI registration function", async () => {
      const mod = await import("../runtime-api.js");
      expect(typeof mod.registerMeichaoCli).toBe("function");
    });
  });
});
