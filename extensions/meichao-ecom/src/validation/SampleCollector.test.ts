import { describe, it, expect, beforeEach } from "vitest";
import type { ProductData } from "../../domain/types.js";
import { SampleCollector } from "./SampleCollector.js";

describe("SampleCollector", () => {
  let collector: SampleCollector;

  const createProduct = (id: string): ProductData => ({
    platform: "taobao",
    platformId: id,
    title: `Product ${id}`,
    price: 99.99,
    currency: "CNY",
    sourceUrl: `https://example.com/${id}`,
    sales: 100,
    salesPeriod: "month",
    status: "active",
    priority: "P1",
    isTrending: false,
  });

  beforeEach(() => {
    collector = new SampleCollector(5);
  });

  describe("add", () => {
    it("should add samples up to max limit", () => {
      for (let i = 0; i < 10; i++) {
        collector.add(createProduct(`id-${i}`), "source-1");
      }

      const samples = collector.getSamples();
      expect(samples).toHaveLength(5);
    });

    it("should return true when sample is added", () => {
      expect(collector.add(createProduct("id-1"), "source-1")).toBe(true);
    });

    it("should return false when max samples reached", () => {
      for (let i = 0; i < 5; i++) {
        collector.add(createProduct(`id-${i}`), "source-1");
      }
      expect(collector.add(createProduct("id-6"), "source-1")).toBe(false);
    });
  });

  describe("getSamples", () => {
    it("should return all collected samples", () => {
      collector.add(createProduct("id-1"), "source-1");
      collector.add(createProduct("id-2"), "source-2");

      const samples = collector.getSamples();
      expect(samples).toHaveLength(2);
      expect(samples[0].productId).toBe("id-1");
      expect(samples[1].productId).toBe("id-2");
    });

    it("should return a copy of samples", () => {
      collector.add(createProduct("id-1"), "source-1");

      const samples1 = collector.getSamples();
      const samples2 = collector.getSamples();

      expect(samples1).not.toBe(samples2);
      expect(samples1).toEqual(samples2);
    });
  });

  describe("getMaskedSamples", () => {
    it("should mask product IDs", () => {
      collector.add(createProduct("1234567890"), "source-1");

      const samples = collector.getMaskedSamples();
      expect(samples[0].productId).toBe("12****90");
    });

    it("should mask short product IDs", () => {
      collector.add(createProduct("123"), "source-1");

      const samples = collector.getMaskedSamples();
      expect(samples[0].productId).toBe("****");
    });
  });

  describe("reset", () => {
    it("should clear all samples", () => {
      collector.add(createProduct("id-1"), "source-1");
      collector.add(createProduct("id-2"), "source-2");

      collector.reset();

      expect(collector.getSamples()).toHaveLength(0);
    });
  });
});
