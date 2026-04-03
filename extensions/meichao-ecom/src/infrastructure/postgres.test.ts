import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("pg", () => {
  const mockQuery = vi.fn();
  const mockEnd = vi.fn();
  const mockConnect = vi.fn();
  const mockPool = vi.fn(function () {
    return {
      query: mockQuery,
      end: mockEnd,
      connect: mockConnect,
    };
  });
  return {
    default: {
      Pool: mockPool,
    },
  };
});

describe("postgres", () => {
  let mockPoolInstance: {
    query: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
  };
  let postgres: typeof import("../storage/postgres.js");

  beforeEach(async () => {
    vi.clearAllMocks();
    postgres = await import("../storage/postgres.js");
    const pg = await import("pg");
    mockPoolInstance = new (pg.default.Pool as unknown as ReturnType<
      typeof vi.fn
    >)() as unknown as {
      query: ReturnType<typeof vi.fn>;
      end: ReturnType<typeof vi.fn>;
      connect: ReturnType<typeof vi.fn>;
    };
  });

  afterEach(async () => {
    await postgres.closePool();
  });

  describe("createPool", () => {
    it("should create a connection pool with default config", async () => {
      const pool = postgres.createPool();
      const pg = await import("pg");
      expect(pg.default.Pool).toHaveBeenCalled();
      expect(pool).toBeDefined();
      expect(pool).toHaveProperty("query");
    });
  });

  describe("getPool", () => {
    it("should return existing pool", async () => {
      postgres.createPool();
      const pool = postgres.getPool();
      expect(pool).toBeDefined();
      expect(pool).toHaveProperty("query");
      expect(pool).toHaveProperty("end");
      expect(pool).toHaveProperty("connect");
    });

    it("should create pool if not exists", async () => {
      const pool = postgres.getPool();
      expect(pool).toBeDefined();
      expect(pool).toHaveProperty("query");
      expect(pool).toHaveProperty("end");
      expect(pool).toHaveProperty("connect");
    });
  });

  describe("closePool", () => {
    it("should close the pool", async () => {
      postgres.createPool();
      await postgres.closePool();
      expect(mockPoolInstance.end).toHaveBeenCalled();
    });
  });

  describe("query", () => {
    it("should execute query and return rows", async () => {
      const mockRows = [{ id: 1, name: "test" }];
      mockPoolInstance.query.mockResolvedValue({ rows: mockRows });

      const result = await postgres.query("SELECT * FROM test");

      expect(mockPoolInstance.query).toHaveBeenCalledWith("SELECT * FROM test", undefined);
      expect(result).toEqual(mockRows);
    });

    it("should execute query with params", async () => {
      const mockRows = [{ id: 1, name: "test" }];
      mockPoolInstance.query.mockResolvedValue({ rows: mockRows });

      const result = await postgres.query("SELECT * FROM test WHERE id = $1", [1]);

      expect(mockPoolInstance.query).toHaveBeenCalledWith("SELECT * FROM test WHERE id = $1", [1]);
      expect(result).toEqual(mockRows);
    });
  });

  describe("queryOne", () => {
    it("should return first row", async () => {
      const mockRows = [{ id: 1, name: "test" }];
      mockPoolInstance.query.mockResolvedValue({ rows: mockRows });

      const result = await postgres.queryOne("SELECT * FROM test WHERE id = $1", [1]);

      expect(result).toEqual(mockRows[0]);
    });

    it("should return null if no rows", async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [] });

      const result = await postgres.queryOne("SELECT * FROM test WHERE id = $1", [999]);

      expect(result).toBeNull();
    });
  });

  describe("transaction", () => {
    it("should execute transaction successfully", async () => {
      const mockClient = {
        query: vi.fn(),
        release: vi.fn(),
      };
      mockPoolInstance.connect.mockResolvedValue(mockClient);

      const result = await postgres.transaction(async (client) => {
        await client.query("INSERT INTO test VALUES (1)");
        return "success";
      });

      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("INSERT INTO test VALUES (1)");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
      expect(result).toBe("success");
    });

    it("should rollback on error", async () => {
      const mockClient = {
        query: vi.fn().mockImplementation(async (sql: string) => {
          if (sql === "INSERT INTO test VALUES (1)") {
            throw new Error("Insert failed");
          }
        }),
        release: vi.fn(),
      };
      mockPoolInstance.connect.mockResolvedValue(mockClient);

      await expect(
        postgres.transaction(async (client) => {
          await client.query("INSERT INTO test VALUES (1)");
          return "success";
        }),
      ).rejects.toThrow("Insert failed");

      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe("healthCheck", () => {
    it("should return true on successful query", async () => {
      mockPoolInstance.query.mockResolvedValue({ rows: [{ "?column?": 1 }] });

      const result = await postgres.healthCheck();

      expect(result).toBe(true);
    });

    it("should return false on query failure", async () => {
      mockPoolInstance.query.mockRejectedValue(new Error("Connection failed"));

      const result = await postgres.healthCheck();

      expect(result).toBe(false);
    });
  });
});
