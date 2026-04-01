import { describe, it, expect } from "vitest";
import type { ValidationResult } from "../PlatformValidator.js";
import { ValidationReport, formatDuration } from "../ValidationReport.js";

function createMockResult(overrides: Partial<ValidationResult> = {}): ValidationResult {
  return {
    platform: "taobao",
    timestamp: Date.now(),
    duration: 5000,
    stats: {
      total: 10,
      successes: 8,
      failures: 2,
      successRate: 80,
      perSourceStats: [
        {
          sourceId: "source-1",
          sourceType: "official_api",
          total: 5,
          successes: 5,
          failures: 0,
          successRate: 100,
        },
        {
          sourceId: "source-2",
          sourceType: "third_party_api",
          total: 5,
          successes: 3,
          failures: 2,
          successRate: 60,
        },
      ],
      failureReasons: [{ reason: "timeout", count: 2 }],
    },
    degradation: {
      totalFallbacks: 2,
      paths: [{ path: ["source-1", "source-2"], count: 2 }],
      events: [
        { fromSource: "source-1", toSource: "source-2", timestamp: Date.now(), productId: "p1" },
      ],
    },
    samples: [
      {
        platform: "taobao",
        productId: "1234567890",
        title: "Test Product",
        price: 99.99,
        currency: "CNY",
        source: "source-1",
        collectedAt: Date.now(),
      },
    ],
    ...overrides,
  };
}

describe("ValidationReport", () => {
  describe("toText", () => {
    it("should generate human-readable text report", () => {
      const result = createMockResult();
      const report = ValidationReport.fromResult(result);
      const text = report.toText();

      expect(text).toContain("Platform Validation Report: TAOBAO");
      expect(text).toContain("Success Rate: 80.00%");
      expect(text).toContain("Successes: 8");
      expect(text).toContain("Failures: 2");
    });

    it("should include per-source statistics", () => {
      const result = createMockResult();
      const report = ValidationReport.fromResult(result);
      const text = report.toText();

      expect(text).toContain("Per-Source Statistics");
      expect(text).toContain("source-1");
      expect(text).toContain("source-2");
    });

    it("should include failure reasons", () => {
      const result = createMockResult();
      const report = ValidationReport.fromResult(result);
      const text = report.toText();

      expect(text).toContain("Failure Reasons");
      expect(text).toContain("timeout: 2");
    });

    it("should include degradation info", () => {
      const result = createMockResult();
      const report = ValidationReport.fromResult(result);
      const text = report.toText();

      expect(text).toContain("Degradation Flow");
      expect(text).toContain("Total Fallbacks: 2");
    });

    it("should mask product IDs when requested", () => {
      const result = createMockResult();
      const report = ValidationReport.fromResult(result);
      const text = report.toText(true);

      expect(text).toContain("12****90");
      expect(text).not.toContain("1234567890");
    });
  });

  describe("toJSON", () => {
    it("should generate valid JSON", () => {
      const result = createMockResult();
      const report = ValidationReport.fromResult(result);
      const json = report.toJSON();

      expect(() => JSON.parse(json)).not.toThrow();
    });

    it("should include all required fields", () => {
      const result = createMockResult();
      const report = ValidationReport.fromResult(result);
      const parsed = JSON.parse(report.toJSON());

      expect(parsed.platform).toBe("taobao");
      expect(parsed.stats.total).toBe(10);
      expect(parsed.samples).toHaveLength(1);
    });

    it("should mask product IDs when requested", () => {
      const result = createMockResult();
      const report = ValidationReport.fromResult(result);
      const parsed = JSON.parse(report.toJSON(true));

      expect(parsed.samples[0].productId).toBe("12****90");
    });
  });
});

describe("formatDuration", () => {
  it("should format milliseconds", () => {
    expect(formatDuration(500)).toBe("500ms");
  });

  it("should format seconds", () => {
    expect(formatDuration(5000)).toBe("5.00s");
  });

  it("should format minutes", () => {
    expect(formatDuration(120000)).toBe("2.00m");
  });
});
