import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("redis", () => {
  const mockClient = {
    isOpen: false,
    connect: vi.fn(async function (this: { isOpen: boolean }) {
      this.isOpen = true;
    }),
    disconnect: vi.fn(async function (this: { isOpen: boolean }) {
      this.isOpen = false;
    }),
    ping: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    keys: vi.fn(),
  };
  return {
    createClient: vi.fn(() => mockClient),
  };
});

describe("redis", () => {
  let redis: typeof import("./cache/redis.js");
  let mockClient: {
    isOpen: boolean;
    connect: ReturnType<typeof vi.fn>;
    disconnect: ReturnType<typeof vi.fn>;
    ping: ReturnType<typeof vi.fn>;
    get: ReturnType<typeof vi.fn>;
    set: ReturnType<typeof vi.fn>;
    del: ReturnType<typeof vi.fn>;
    keys: ReturnType<typeof vi.fn>;
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    redis = await import("./cache/redis.js");
    const redisModule = await import("redis");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mockClient = (redisModule.createClient as any)() as {
      isOpen: boolean;
      connect: ReturnType<typeof vi.fn>;
      disconnect: ReturnType<typeof vi.fn>;
      ping: ReturnType<typeof vi.fn>;
      get: ReturnType<typeof vi.fn>;
      set: ReturnType<typeof vi.fn>;
      del: ReturnType<typeof vi.fn>;
      keys: ReturnType<typeof vi.fn>;
    };
  });

  describe("createClient_", () => {
    it("should create redis client with default config", async () => {
      const client = redis.createClient_();
      expect(client).toBeDefined();
      expect(client).toBe(mockClient);
    });

    it("should create redis client with custom config", async () => {
      const client = redis.createClient_({
        host: "custom-host",
        port: 6380,
        password: "secret",
      });
      expect(client).toBeDefined();
    });
  });

  describe("getClient", () => {
    it("should return existing client", async () => {
      redis.createClient_();
      const client = redis.getClient();
      expect(client).toBeDefined();
    });

    it("should create client if not exists", async () => {
      const client = redis.getClient();
      expect(client).toBeDefined();
    });
  });

  describe("connectClient", () => {
    it("should connect if not open", async () => {
      const client = redis.createClient_();
      (mockClient as { isOpen: boolean }).isOpen = false;
      await redis.connectClient();
      expect(client.connect).toHaveBeenCalled();
    });

    it("should not connect if already open", async () => {
      const client = redis.createClient_();
      (mockClient as { isOpen: boolean }).isOpen = true;
      await redis.connectClient();
      expect(client.connect).not.toHaveBeenCalled();
    });
  });

  describe("disconnectClient", () => {
    it("should disconnect if open", async () => {
      const client = redis.createClient_();
      (mockClient as { isOpen: boolean }).isOpen = true;
      await redis.disconnectClient();
      expect(client.disconnect).toHaveBeenCalled();
    });

    it("should do nothing if not open", async () => {
      const client = redis.createClient_();
      (mockClient as { isOpen: boolean }).isOpen = false;
      await redis.disconnectClient();
      expect(client.disconnect).not.toHaveBeenCalled();
    });
  });

  describe("healthCheck", () => {
    it("should return true on successful ping", async () => {
      const client = redis.createClient_();
      (mockClient as { isOpen: boolean }).isOpen = true;
      (client.ping as ReturnType<typeof vi.fn>).mockResolvedValue("PONG");

      const result = await redis.healthCheck();

      expect(result).toBe(true);
    });

    it("should return false on ping failure", async () => {
      const client = redis.createClient_();
      (client.ping as ReturnType<typeof vi.fn>).mockRejectedValue(new Error("Connection failed"));

      const result = await redis.healthCheck();

      expect(result).toBe(false);
    });
  });
});
