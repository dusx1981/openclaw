import { describe, it, expect, beforeEach } from "vitest";
import { StatsCollector, categorizeFailure } from "./ValidationStats.js";

describe("StatsCollector", () => {
  let collector: StatsCollector;

  beforeEach(() => {
    collector = new StatsCollector();
  });

  describe("recordSuccess", () => {
    it("should record successful operations", () => {
      collector.recordSuccess("source-1", "official_api");
      collector.recordSuccess("source-1", "official_api");
      collector.recordSuccess("source-2", "third_party_api");

      const stats = collector.getStats();
      expect(stats.total).toBe(3);
      expect(stats.successes).toBe(3);
      expect(stats.failures).toBe(0);
      expect(stats.successRate).toBe(100);
    });
  });

  describe("recordFailure", () => {
    it("should record failed operations", () => {
      collector.recordFailure("source-1", "official_api", "timeout");
      collector.recordFailure("source-1", "official_api", "rate_limit");

      const stats = collector.getStats();
      expect(stats.total).toBe(2);
      expect(stats.successes).toBe(0);
      expect(stats.failures).toBe(2);
      expect(stats.successRate).toBe(0);
    });
  });

  describe("per-source statistics", () => {
    it("should track statistics per source", () => {
      collector.recordSuccess("source-1", "official_api");
      collector.recordSuccess("source-1", "official_api");
      collector.recordFailure("source-1", "official_api", "timeout");
      collector.recordSuccess("source-2", "third_party_api");

      const stats = collector.getStats();
      expect(stats.perSourceStats).toHaveLength(2);

      const source1 = stats.perSourceStats.find((s) => s.sourceId === "source-1");
      expect(source1?.total).toBe(3);
      expect(source1?.successRate).toBeCloseTo(66.67, 1);

      const source2 = stats.perSourceStats.find((s) => s.sourceId === "source-2");
      expect(source2?.successRate).toBe(100);
    });
  });

  describe("failure reasons", () => {
    it("should categorize and count failure reasons", () => {
      collector.recordFailure("source-1", "official_api", "timeout");
      collector.recordFailure("source-1", "official_api", "timeout");
      collector.recordFailure("source-2", "third_party_api", "rate_limit");

      const stats = collector.getStats();
      expect(stats.failureReasons).toHaveLength(2);

      const timeout = stats.failureReasons.find((f) => f.reason === "timeout");
      expect(timeout?.count).toBe(2);

      const rateLimit = stats.failureReasons.find((f) => f.reason === "rate_limit");
      expect(rateLimit?.count).toBe(1);
    });
  });

  describe("reset", () => {
    it("should reset all statistics", () => {
      collector.recordSuccess("source-1", "official_api");
      collector.recordFailure("source-1", "official_api", "timeout");

      collector.reset();

      const stats = collector.getStats();
      expect(stats.total).toBe(0);
      expect(stats.perSourceStats).toHaveLength(0);
      expect(stats.failureReasons).toHaveLength(0);
    });
  });
});

describe("categorizeFailure", () => {
  it("should categorize timeout errors", () => {
    expect(categorizeFailure(new Error("Request timeout"))).toBe("timeout");
    expect(categorizeFailure(new Error("ETIMEDOUT"))).toBe("timeout");
  });

  it("should categorize connection errors", () => {
    expect(categorizeFailure(new Error("ECONNREFUSED"))).toBe("connection_refused");
    expect(categorizeFailure(new Error("Connection refused"))).toBe("connection_refused");
  });

  it("should categorize DNS errors", () => {
    expect(categorizeFailure(new Error("ENOTFOUND"))).toBe("dns_failure");
    expect(categorizeFailure(new Error("DNS lookup failed"))).toBe("dns_failure");
  });

  it("should categorize rate limit errors", () => {
    expect(categorizeFailure(new Error("Rate limit exceeded"))).toBe("rate_limited");
    expect(categorizeFailure(new Error("429 Too Many Requests"))).toBe("rate_limited");
  });

  it("should categorize auth errors", () => {
    expect(categorizeFailure(new Error("Unauthorized access"))).toBe("auth_error");
    expect(categorizeFailure(new Error("401 Unauthorized"))).toBe("auth_error");
    expect(categorizeFailure(new Error("403 Forbidden"))).toBe("auth_error");
  });

  it("should categorize not found errors", () => {
    expect(categorizeFailure(new Error("Not found"))).toBe("not_found");
    expect(categorizeFailure(new Error("404 Not Found"))).toBe("not_found");
  });

  it("should return unknown for unrecognized errors", () => {
    expect(categorizeFailure(new Error("Something went wrong"))).toBe("unknown");
  });
});
