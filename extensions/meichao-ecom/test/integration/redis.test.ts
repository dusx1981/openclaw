import { createClient } from "redis";
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startRedis, stopContainers, SKIP_INTEGRATION } from "../helpers/database.js";

const describeIntegration = SKIP_INTEGRATION ? describe.skip : describe;

describeIntegration("Redis Integration", () => {
  let redisClient: ReturnType<typeof createClient>;
  let redisHost: string;
  let redisPort: number;

  beforeAll(async () => {
    if (SKIP_INTEGRATION) return;

    const info = await startRedis();
    redisHost = info.host;
    redisPort = info.port;

    redisClient = createClient({
      url: `redis://${redisHost}:${redisPort}`,
    });

    await redisClient.connect();
  }, 60000);

  afterAll(async () => {
    if (SKIP_INTEGRATION) return;

    if (redisClient) {
      await redisClient.quit();
    }
    await stopContainers();
  }, 30000);

  it("should connect to redis container", async () => {
    const pong = await redisClient.ping();
    expect(pong).toBe("PONG");
  });

  it("should set and get values", async () => {
    await redisClient.set("test:key", "test-value");
    const value = await redisClient.get("test:key");
    expect(value).toBe("test-value");
  });

  it("should handle expiration", async () => {
    await redisClient.set("test:expiring", "will-expire", { EX: 1 });

    let value = await redisClient.get("test:expiring");
    expect(value).toBe("will-expire");

    await new Promise((r) => setTimeout(r, 1100));

    value = await redisClient.get("test:expiring");
    expect(value).toBeNull();
  });

  it("should handle hash operations", async () => {
    await redisClient.hSet("test:hash", "field1", "value1");
    await redisClient.hSet("test:hash", "field2", "value2");

    const all = await redisClient.hGetAll("test:hash");
    expect(all.field1).toBe("value1");
    expect(all.field2).toBe("value2");
  });

  it("should handle list operations", async () => {
    await redisClient.rPush("test:list", ["item1", "item2", "item3"]);

    const items = await redisClient.lRange("test:list", 0, -1);
    expect(items).toHaveLength(3);
    expect(items[0]).toBe("item1");
    expect(items[2]).toBe("item3");
  });

  it("should handle set operations", async () => {
    await redisClient.sAdd("test:set", ["member1", "member2", "member3"]);

    const members = await redisClient.sMembers("test:set");
    expect(members).toHaveLength(3);
    expect(members).toContain("member1");

    const isMember = await redisClient.sIsMember("test:set", "member1");
    expect(isMember).toBe(true);
  });

  it("should increment counters", async () => {
    await redisClient.set("test:counter", "0");

    await redisClient.incr("test:counter");
    await redisClient.incr("test:counter");
    await redisClient.incrBy("test:counter", 5);

    const value = await redisClient.get("test:counter");
    expect(value).toBe("7");
  });

  it("should handle json values", async () => {
    const data = { name: "test", count: 10 };
    await redisClient.set("test:json", JSON.stringify(data));

    const raw = await redisClient.get("test:json");
    const parsed = JSON.parse(raw!);
    expect(parsed.name).toBe("test");
    expect(parsed.count).toBe(10);
  });
});
