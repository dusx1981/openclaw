import { describe, it, expect, beforeEach, vi, Mock } from "vitest";
import type { TumeClient } from "./TumeClient.js";
import { TumeProductApi } from "./TumeProductApi.js";

function createMockClient(): { client: TumeClient; execute: Mock } {
  const execute = vi.fn();
  return { client: { execute } as unknown as TumeClient, execute };
}

describe("TumeProductApi", () => {
  let api: TumeProductApi;
  let mockClient: { client: TumeClient; execute: Mock };

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = createMockClient();
    api = new TumeProductApi(mockClient.client);
  });

  it("should fetch product", async () => {
    mockClient.execute.mockResolvedValue({
      product: {
        product_id: "p1",
        title: "Test",
        price: 99,
        main_image: "img.jpg",
        status: "active",
      },
    });
    const result = await api.getProductDetail("p1");
    expect(result?.platform).toBe("tume");
    expect(result?.title).toBe("Test");
  });

  it("should search products", async () => {
    mockClient.execute.mockResolvedValue({
      products: [
        { product_id: "p1", title: "Test", price: 99, main_image: "img.jpg", status: "active" },
      ],
      total: 1,
    });
    const result = await api.searchProducts("test");
    expect(result.products).toHaveLength(1);
  });
});
