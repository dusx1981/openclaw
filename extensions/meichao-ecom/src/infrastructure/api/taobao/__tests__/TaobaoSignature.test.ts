import { describe, it, expect } from "vitest";
import { TaobaoSignature } from "../TaobaoApiClient.js";

describe("TaobaoSignature", () => {
  describe("generate", () => {
    it("should generate HMAC-SHA256 signature", () => {
      const params = {
        app_key: "test_app_key",
        method: "taobao.item.seller.get",
        timestamp: "2024-01-01 00:00:00",
        format: "json",
        v: "2.0",
        sign_method: "hmac-sha256",
        num_iid: "123456",
      };

      const secret = "test_secret";
      const sign = TaobaoSignature.generate(params, secret);

      expect(sign).toMatch(/^[A-F0-9]{64}$/);
    });

    it("should produce consistent signatures for same input", () => {
      const params = {
        method: "test.method",
        timestamp: "2024-01-01 00:00:00",
        param1: "value1",
      };

      const secret = "secret";
      const sign1 = TaobaoSignature.generate(params, secret);
      const sign2 = TaobaoSignature.generate(params, secret);

      expect(sign1).toBe(sign2);
    });

    it("should handle empty values", () => {
      const params = {
        method: "test.method",
        empty: "",
        value: "test",
      };

      const sign = TaobaoSignature.generate(params, "secret");

      expect(sign).toMatch(/^[A-F0-9]{64}$/);
    });

    it("should sort parameters alphabetically", () => {
      const params1 = {
        z_param: "z",
        a_param: "a",
        m_param: "m",
      };

      const params2 = {
        a_param: "a",
        m_param: "m",
        z_param: "z",
      };

      const secret = "secret";
      const sign1 = TaobaoSignature.generate(params1, secret);
      const sign2 = TaobaoSignature.generate(params2, secret);

      expect(sign1).toBe(sign2);
    });
  });
});
