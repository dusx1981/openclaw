import pg from "pg";
import { describe, it, expect, beforeEach, afterEach, vi, Mock } from "vitest";
import {
  TransactionManager,
  TransactionTimeoutError,
  UniqueConstraintViolationError,
  DeadlockError,
  SerializationFailureError,
  ConnectionPoolExhaustedError,
} from "./TransactionManager.js";

vi.mock("./postgres.js", () => ({
  getPool: vi.fn(),
}));

interface MockClient {
  query: Mock;
  release: Mock;
}

const createMockClient = (): MockClient => {
  const mockQuery = vi.fn();
  const mockRelease = vi.fn();

  return {
    query: mockQuery,
    release: mockRelease,
  };
};

const createMockPool = (mockClient: MockClient) => ({
  connect: vi.fn().mockResolvedValue(mockClient),
});

describe("TransactionManager", () => {
  let manager: TransactionManager;
  let mockClient: MockClient;
  let mockPool: any;

  beforeEach(async () => {
    vi.clearAllMocks();

    mockClient = createMockClient();
    mockPool = createMockPool(mockClient);

    const postgres = await import("./postgres.js");
    vi.spyOn(postgres, "getPool").mockReturnValue(mockPool as any);

    manager = new TransactionManager({ defaultTimeout: 30000, defaultMaxRetries: 3 });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
  });

  describe("runInTransaction", () => {
    it("should execute transaction successfully", async () => {
      mockClient.query.mockResolvedValueOnce(undefined);
      mockClient.query.mockResolvedValueOnce(undefined);
      mockClient.query.mockResolvedValueOnce(undefined);

      const result = await manager.runInTransaction(async () => {
        return { data: "test" };
      });

      expect(result).toEqual({ data: "test" });
      expect(mockClient.query).toHaveBeenCalledWith("BEGIN");
      expect(mockClient.query).toHaveBeenCalledWith("COMMIT");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should rollback on error", async () => {
      mockClient.query.mockResolvedValueOnce(undefined);
      mockClient.query.mockResolvedValueOnce(undefined);

      await expect(
        manager.runInTransaction(async () => {
          throw new Error("Test error");
        }),
      ).rejects.toThrow("Test error");

      expect(mockClient.query).toHaveBeenCalledWith("ROLLBACK");
      expect(mockClient.release).toHaveBeenCalled();
    });

    it("should use default isolation level", async () => {
      mockClient.query.mockResolvedValueOnce(undefined);
      mockClient.query.mockResolvedValueOnce(undefined);
      mockClient.query.mockResolvedValueOnce(undefined);

      await manager.runInTransaction(async () => "result");

      expect(mockClient.query).toHaveBeenCalledWith(
        "SET TRANSACTION ISOLATION LEVEL READ COMMITTED",
      );
    });

    it("should use custom isolation level", async () => {
      mockClient.query.mockResolvedValueOnce(undefined);
      mockClient.query.mockResolvedValueOnce(undefined);
      mockClient.query.mockResolvedValueOnce(undefined);

      await manager.runInTransaction(async () => "result", { isolationLevel: "SERIALIZABLE" });

      expect(mockClient.query).toHaveBeenCalledWith("SET TRANSACTION ISOLATION LEVEL SERIALIZABLE");
    });
  });

  describe("Transaction timeout", () => {
    it("should support timeout configuration", async () => {
      mockClient.query.mockResolvedValue(undefined);

      await manager.runInTransaction(async () => "result", { timeout: 5000 });

      expect(mockClient.query).toHaveBeenCalled();
    });

    it("should clear timeout on successful completion", async () => {
      mockClient.query.mockResolvedValue(undefined);

      const result = await manager.runInTransaction(async () => "quick result", { timeout: 5000 });

      expect(result).toBe("quick result");
    });
  });

  describe("Error classification", () => {
    it("should classify unique constraint violation", async () => {
      const pgError = Object.assign(new Error("duplicate key"), {
        code: "23505",
        detail: "Key (id)=(123) already exists",
        name: "DatabaseError",
      });

      mockClient.query.mockRejectedValueOnce(pgError);
      mockClient.query.mockResolvedValueOnce(undefined);

      await expect(
        manager.runInTransaction(async () => {
          throw pgError;
        }),
      ).rejects.toThrow(UniqueConstraintViolationError);
    });

    it("should classify deadlock error", async () => {
      const pgError = Object.assign(new Error("deadlock detected"), {
        code: "40P01",
        detail: "Process 123 waits for ShareLock on transaction 456",
        name: "DatabaseError",
      });

      mockClient.query.mockRejectedValueOnce(pgError);
      mockClient.query.mockResolvedValueOnce(undefined);

      await expect(
        manager.runInTransaction(async () => {
          throw pgError;
        }),
      ).rejects.toThrow(DeadlockError);
    });

    it("should classify connection pool exhausted", async () => {
      const poolError = new Error("Connection pool exhausted");
      mockPool.connect.mockRejectedValue(poolError);

      await expect(manager.runInTransaction(async () => "result")).rejects.toThrow(
        ConnectionPoolExhaustedError,
      );
    });
  });

  describe("Retry logic", () => {
    it("should support max retries configuration", async () => {
      const pgError = Object.assign(new Error("could not serialize access"), {
        code: "40001",
        name: "DatabaseError",
      });

      mockClient.query.mockImplementation(async (sql: string) => {
        if (sql === "BEGIN" || sql === "ROLLBACK" || sql.startsWith("SET TRANSACTION")) {
          return undefined;
        }
        throw pgError;
      });

      const customManager = new TransactionManager({ defaultMaxRetries: 0 });

      await expect(
        customManager.runInTransaction(async () => {
          throw pgError;
        }),
      ).rejects.toThrow();
    });
  });

  describe("Concurrent transactions", () => {
    it("should handle multiple concurrent transactions", async () => {
      const clients = [createMockClient(), createMockClient(), createMockClient()];
      clients.forEach((client) => {
        client.query.mockResolvedValue(undefined);
      });

      mockPool.connect.mockImplementation(async () => {
        return clients.shift();
      });

      const promises = [
        manager.runInTransaction(async () => "result1"),
        manager.runInTransaction(async () => "result2"),
        manager.runInTransaction(async () => "result3"),
      ];

      const results = await Promise.all(promises);

      expect(results).toEqual(["result1", "result2", "result3"]);
      expect(mockPool.connect).toHaveBeenCalledTimes(3);
      clients.forEach((client) => {
        expect(client.release).toHaveBeenCalled();
      });
    });
  });
});
