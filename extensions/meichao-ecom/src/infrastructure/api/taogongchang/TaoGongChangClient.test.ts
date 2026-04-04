import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { Alibaba1688ApiClient } from "../alibaba/Alibaba1688ApiClient.js";
import { TaoGongChangClient, TaoGongChangProductApi } from "./TaoGongChangClient.js";

vi.mock("../alibaba/Alibaba1688ApiClient.js", () => ({
  Alibaba1688ApiClient: {
    fromEnv: vi.fn(() => ({ execute: vi.fn() })),
  },
}));

describe("TaoGongChangClient", () => {
  it("should create from env", () => {
    const client = TaoGongChangClient.fromEnv();
    expect(client).toBeDefined();
  });
});

describe("TaoGongChangProductApi", () => {
  let api: TaoGongChangProductApi;
  let mockExecute: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute = vi.fn();
    const client = { execute: mockExecute } as unknown as TaoGongChangClient;
    api = new TaoGongChangProductApi(client);
  });

  it("should fetch TaoGongChang product (with tag)", async () => {
    mockExecute.mockResolvedValue({
      product: {
        productId: "123",
        subject: "TaoGongChang Product",
        price: "99",
        imageUrl: "img.jpg",
        detailUrl: "url",
        tags: ["淘工厂"],
        moq: 10,
        leadTime: 7,
      },
    });
    const result = await api.getProductDetail("123");
    expect(result?.platform).toBe("taogongchang");
    expect(result?.extraData?.isTaoGongChang).toBe(true);
    expect(result?.extraData?.moq).toBe(10);
  });

  it("should return null for non-TaoGongChang product", async () => {
    mockExecute.mockResolvedValue({
      product: {
        productId: "123",
        subject: "Normal 1688 Product",
        price: "99",
        imageUrl: "img.jpg",
        detailUrl: "url",
        tags: [],
      },
    });
    const result = await api.getProductDetail("123");
    expect(result).toBeNull();
  });
});
