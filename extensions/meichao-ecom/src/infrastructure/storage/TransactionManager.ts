import pg from "pg";
import { getPool } from "./postgres.js";

export type IsolationLevel = "READ COMMITTED" | "REPEATABLE READ" | "SERIALIZABLE";

export interface TransactionOptions {
  isolationLevel?: IsolationLevel;
  timeout?: number;
  maxRetries?: number;
}

export class TransactionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "TransactionError";
  }
}

export class TransactionTimeoutError extends TransactionError {
  constructor(timeout: number) {
    super(`Transaction timed out after ${timeout}ms`, "TRANSACTION_TIMEOUT", { timeout });
    this.name = "TransactionTimeoutError";
  }
}

export class UniqueConstraintViolationError extends TransactionError {
  constructor(constraintName: string, conflictingValue: unknown) {
    super(`Unique constraint violation: ${constraintName}`, "UNIQUE_CONSTRAINT_VIOLATION", {
      constraintName,
      conflictingValue,
    });
    this.name = "UniqueConstraintViolationError";
  }
}

export class DeadlockError extends TransactionError {
  constructor(details: unknown) {
    super("Deadlock detected", "DEADLOCK", details);
    this.name = "DeadlockError";
  }
}

export class SerializationFailureError extends TransactionError {
  constructor(attempts: number) {
    super(`Serialization failure after ${attempts} attempts`, "SERIALIZATION_FAILURE", {
      attempts,
    });
    this.name = "SerializationFailureError";
  }
}

export class ConnectionPoolExhaustedError extends TransactionError {
  constructor() {
    super("Connection pool exhausted", "POOL_EXHAUSTED");
    this.name = "ConnectionPoolExhaustedError";
  }
}

const DEFAULT_TIMEOUT = 30000;
const DEFAULT_MAX_RETRIES = 3;
const SERIALIZATION_FAILURE_CODE = "40001";

function classifyError(error: unknown): TransactionError {
  if (error instanceof pg.DatabaseError) {
    const pgError = error as pg.DatabaseError;

    if (pgError.code === "23505") {
      const constraintName = pgError.detail || "unknown";
      return new UniqueConstraintViolationError(constraintName, pgError.detail);
    }

    if (pgError.code === "40P01") {
      return new DeadlockError(pgError.detail);
    }

    if (pgError.code === SERIALIZATION_FAILURE_CODE) {
      return new SerializationFailureError(0);
    }
  }

  if (error && typeof error === "object" && "code" in error) {
    const pgError = error as any;

    if (pgError.code === "23505") {
      const constraintName = pgError.detail || "unknown";
      return new UniqueConstraintViolationError(constraintName, pgError.detail);
    }

    if (pgError.code === "40P01") {
      return new DeadlockError(pgError.detail);
    }

    if (pgError.code === SERIALIZATION_FAILURE_CODE) {
      return new SerializationFailureError(0);
    }
  }

  if (error instanceof Error) {
    if (error.message.includes("Connection pool exhausted")) {
      return new ConnectionPoolExhaustedError();
    }
  }

  return new TransactionError(
    error instanceof Error ? error.message : "Unknown transaction error",
    "UNKNOWN",
    error,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class TransactionManager {
  private readonly defaultTimeout: number;
  private readonly defaultMaxRetries: number;

  constructor(options?: { defaultTimeout?: number; defaultMaxRetries?: number }) {
    this.defaultTimeout = options?.defaultTimeout ?? DEFAULT_TIMEOUT;
    this.defaultMaxRetries = options?.defaultMaxRetries ?? DEFAULT_MAX_RETRIES;
  }

  async runInTransaction<T>(
    fn: (client: pg.PoolClient) => Promise<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    const timeout = options?.timeout ?? this.defaultTimeout;
    const maxRetries = options?.maxRetries ?? this.defaultMaxRetries;
    const isolationLevel = options?.isolationLevel ?? "READ COMMITTED";

    let attempts = 0;
    let lastError: TransactionError | null = null;

    while (attempts <= maxRetries) {
      try {
        return await this.executeWithTimeout(fn, timeout, isolationLevel);
      } catch (error) {
        const classifiedError = classifyError(error);

        if (classifiedError instanceof SerializationFailureError) {
          attempts++;
          if (attempts <= maxRetries) {
            const delay = Math.pow(2, attempts) * 1000;
            await sleep(delay);
            lastError = new SerializationFailureError(attempts);
            continue;
          }
        }

        throw classifiedError;
      }
    }

    throw lastError ?? new TransactionError("Max retries exceeded", "MAX_RETRIES");
  }

  private async executeWithTimeout<T>(
    fn: (client: pg.PoolClient) => Promise<T>,
    timeout: number,
    isolationLevel: IsolationLevel,
  ): Promise<T> {
    const pool = getPool();
    const client = await pool.connect();

    let timeoutId: NodeJS.Timeout | null = null;
    let completed = false;

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          if (!completed) {
            reject(new TransactionTimeoutError(timeout));
          }
        }, timeout);
      });

      const transactionPromise = (async () => {
        const isolationClause = `SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`;
        await client.query("BEGIN");
        await client.query(isolationClause);

        const result = await fn(client);

        await client.query("COMMIT");
        completed = true;

        return result;
      })();

      const result = await Promise.race([transactionPromise, timeoutPromise]);

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      return result;
    } catch (error) {
      completed = true;

      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      try {
        await client.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("Rollback failed:", rollbackError);
      }

      throw error;
    } finally {
      client.release();
    }
  }
}
