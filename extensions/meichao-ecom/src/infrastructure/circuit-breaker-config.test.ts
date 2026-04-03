import { describe, it, expect } from "vitest";
import { DEFAULT_DATA_COLLECTION_SETTINGS } from "../domain/data-source-config.js";
import { DEFAULT_CIRCUIT_BREAKER_CONFIG, DEFAULT_HEALTH_PROBE_CONFIG } from "../domain/types.js";

describe("CircuitBreaker Configuration", () => {
  describe("DEFAULT_DATA_COLLECTION_SETTINGS", () => {
    it("should use DEFAULT_CIRCUIT_BREAKER_CONFIG from types.ts", () => {
      const cb = DEFAULT_DATA_COLLECTION_SETTINGS.circuitBreaker;

      expect(cb).toEqual(DEFAULT_CIRCUIT_BREAKER_CONFIG);
    });

    it("should have correct CircuitBreaker configuration", () => {
      const cb = DEFAULT_DATA_COLLECTION_SETTINGS.circuitBreaker;

      expect(cb.enabled).toBe(true);
      expect(cb.failureThreshold).toBe(5);
      expect(cb.openDuration).toBe(30000); // 30 seconds
      expect(cb.halfOpenMaxCalls).toBe(1);
      expect(cb.successThreshold).toBe(3);
    });

    it("should use DEFAULT_HEALTH_PROBE_CONFIG from types.ts", () => {
      const hp = DEFAULT_DATA_COLLECTION_SETTINGS.healthProbe;

      expect(hp).toEqual(DEFAULT_HEALTH_PROBE_CONFIG);
    });

    it("should have correct HealthProbe configuration", () => {
      const hp = DEFAULT_DATA_COLLECTION_SETTINGS.healthProbe;

      expect(hp.interval).toBe(60000); // 60 seconds
      expect(hp.initialDelay).toBe(5000); // 5 seconds
      expect(hp.timeout).toBe(10000); // 10 seconds
      expect(hp.unhealthyThreshold).toBe(3);
      expect(hp.recoveryThreshold).toBe(2);
    });

    it("should not have cooldown configuration", () => {
      const settings = DEFAULT_DATA_COLLECTION_SETTINGS;

      expect("cooldown" in settings).toBe(false);
    });
  });

  describe("Default value consistency", () => {
    it("should have single source of truth in types.ts", () => {
      expect(DEFAULT_DATA_COLLECTION_SETTINGS.circuitBreaker).toBe(DEFAULT_CIRCUIT_BREAKER_CONFIG);
      expect(DEFAULT_DATA_COLLECTION_SETTINGS.healthProbe).toBe(DEFAULT_HEALTH_PROBE_CONFIG);
    });
  });
});
