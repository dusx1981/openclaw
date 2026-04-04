import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import { TaobaoApiClient } from "../taobao/TaobaoApiClient.js";
import { TmallClient, TmallProductApi } from "./TmallClient.js";

vi.mock("../taobao/TaobaoApiClient.js", () => ({
  TaobaoApiClient: {
    fromEnv: vi.fn(() => ({ execute: vi.fn() })),
  },
}));

describe("TmallClient", () => {
  it("should create from env", () => {
    const client = TmallClient.fromEnv();
    expect(client).toBeDefined();
  });
});

describe("TmallProductApi", () => {
  let api: TmallProductApi;
  let mockExecute: Mock;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExecute = vi.fn();
    const client = { execute: mockExecute } as unknown as TmallClient;
    api = new TmallProductApi(client);
  });

  it("should fetch Tmall product (user_type=1)", async () => {
    mockExecute.mockResolvedValue({
      item: {
        num_iid: "123",
        title: "Tmall Product",
        price: "99",
        pic_url: "img.jpg",
        detail_url: "url",
        nick: "shop",
        user_type: 1,
        volume: 500,
        cid: 1,
      },
    });
    const result = await api.getProductDetail("123");
    expect(result?.platform).toBe("tmall");
    expect(result?.extraData?.isTmall).toBe(true);
  });

  it("should return null for non-Tmall product (user_type=0)", async () => {
    mockExecute.mockResolvedValue({
      item: {
        num_iid: "123",
        title: "Taobao Product",
        price: "99",
        pic_url: "img.jpg",
        detail_url: "url",
        nick: "shop",
        user_type: 0,
        volume: 500,
        cid: 1,
      },
    });
    const result = await api.getProductDetail("123");
    expect(result).toBeNull();
  });
});
