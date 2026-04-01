import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  setPostgresConfig,
  setRedisConfig,
  getPostgresConfig,
  getRedisConfig,
  resetConfig,
} from "./plugin-config.js";

describe("plugin-config", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    resetConfig();
    delete process.env.POSTGRES_HOST;
    delete process.env.POSTGRES_PORT;
    delete process.env.POSTGRES_DB;
    delete process.env.REDIS_HOST;
    delete process.env.REDIS_PORT;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe("getPostgresConfig", () => {
    it("should return default values when no config or env set", () => {
      const config = getPostgresConfig();
      expect(config.port).toBe(5434);
      expect(config.host).toBe("localhost");
    });

    it("should use env values over defaults", () => {
      process.env.POSTGRES_PORT = "5433";
      process.env.POSTGRES_HOST = "db.example.com";
      const config = getPostgresConfig();
      expect(config.port).toBe(5433);
      expect(config.host).toBe("db.example.com");
    });

    it("should use pluginConfig over env values", () => {
      process.env.POSTGRES_PORT = "5433";
      setPostgresConfig({ port: 5435 });
      const config = getPostgresConfig();
      expect(config.port).toBe(5435);
    });
  });

  describe("getRedisConfig", () => {
    it("should return default values when no config or env set", () => {
      const config = getRedisConfig();
      expect(config.port).toBe(6380);
      expect(config.host).toBe("localhost");
    });

    it("should use env values over defaults", () => {
      process.env.REDIS_PORT = "6381";
      process.env.REDIS_HOST = "redis.example.com";
      const config = getRedisConfig();
      expect(config.port).toBe(6381);
      expect(config.host).toBe("redis.example.com");
    });

    it("should use pluginConfig over env values", () => {
      process.env.REDIS_PORT = "6381";
      setRedisConfig({ port: 6382 });
      const config = getRedisConfig();
      expect(config.port).toBe(6382);
    });
  });

  describe("setPostgresConfig", () => {
    it("should accept partial config", () => {
      setPostgresConfig({ port: 5435 });
      const config = getPostgresConfig();
      expect(config.port).toBe(5435);
      expect(config.host).toBe("localhost");
    });

    it("should handle undefined", () => {
      setPostgresConfig({ port: 5435 });
      setPostgresConfig(undefined);
      const config = getPostgresConfig();
      expect(config.port).toBe(5434);
    });
  });

  describe("setRedisConfig", () => {
    it("should accept partial config", () => {
      setRedisConfig({ port: 6382 });
      const config = getRedisConfig();
      expect(config.port).toBe(6382);
      expect(config.host).toBe("localhost");
    });

    it("should handle undefined", () => {
      setRedisConfig({ port: 6382 });
      setRedisConfig(undefined);
      const config = getRedisConfig();
      expect(config.port).toBe(6380);
    });
  });
});
