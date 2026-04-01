import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { MockServer, createMockServer } from "./mock-server.js";

async function fetchJson(
  url: string,
  options?: RequestInit,
): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, options);
  const body = await response.json();
  return { status: response.status, body };
}

describe("MockServer", () => {
  let server: MockServer;
  let baseUrl: string;

  beforeEach(async () => {
    server = new MockServer();
    const info = await server.start();
    baseUrl = info.url;
  });

  afterEach(async () => {
    await server.stop();
  });

  describe("start and stop", () => {
    it("should start server on random port", async () => {
      const newServer = new MockServer();
      const { port, url } = await newServer.start();

      expect(port).toBeGreaterThan(0);
      expect(url).toBe(`http://localhost:${port}`);

      await newServer.stop();
    });

    it("should stop server cleanly", async () => {
      const newServer = new MockServer();
      await newServer.start();
      await newServer.stop();

      expect(newServer.getUrl()).toMatch(/localhost:\d+/);
    });
  });

  describe("respond", () => {
    it("should respond with configured response", async () => {
      server.respond("/api/products", { status: 200, body: { products: [] } });

      const result = await fetchJson(`${baseUrl}/api/products`);

      expect(result.status).toBe(200);
      expect(result.body).toEqual({ products: [] });
    });

    it("should respond with custom headers", async () => {
      server.respond("/api/test", {
        status: 200,
        body: { ok: true },
        headers: { "X-Custom-Header": "test-value" },
      });

      const response = await fetch(`${baseUrl}/api/test`);

      expect(response.headers.get("X-Custom-Header")).toBe("test-value");
    });

    it("should match path by regex", async () => {
      server.respond(/\/api\/products\/\d+/, { status: 200, body: { id: 123 } });

      const result = await fetchJson(`${baseUrl}/api/products/123`);

      expect(result.status).toBe(200);
    });

    it("should return 404 for unmatched paths", async () => {
      const result = await fetchJson(`${baseUrl}/unknown`);

      expect(result.status).toBe(404);
    });

    it("should cycle through multiple responses", async () => {
      server.respond("/api/test", [
        { status: 200, body: { first: true } },
        { status: 200, body: { second: true } },
        { status: 500, body: { error: "failed" } },
      ]);

      const r1 = await fetchJson(`${baseUrl}/api/test`);
      const r2 = await fetchJson(`${baseUrl}/api/test`);
      const r3 = await fetchJson(`${baseUrl}/api/test`);
      const r4 = await fetchJson(`${baseUrl}/api/test`);

      expect(r1.body).toEqual({ first: true });
      expect(r2.body).toEqual({ second: true });
      expect(r3.status).toBe(500);
      expect(r4.body).toEqual({ first: true });
    });

    it("should match method", async () => {
      server.respond("/api/test", { status: 200, body: { get: true } }, "GET");
      server.respond("/api/test", { status: 201, body: { post: true } }, "POST");

      const getResult = await fetchJson(`${baseUrl}/api/test`);
      const postResult = await fetchJson(`${baseUrl}/api/test`, { method: "POST" });

      expect(getResult.body).toEqual({ get: true });
      expect(postResult.status).toBe(201);
    });
  });

  describe("error", () => {
    it("should return error response", async () => {
      server.error("/api/fail", 500);

      const result = await fetchJson(`${baseUrl}/api/fail`);

      expect(result.status).toBe(500);
      expect(result.body).toEqual({ error: "Mock error" });
    });

    it("should support custom error status", async () => {
      server.error("/api/notfound", 404);

      const result = await fetchJson(`${baseUrl}/api/notfound`);

      expect(result.status).toBe(404);
    });
  });

  describe("delay", () => {
    it("should delay response", async () => {
      server.respond("/api/slow", { status: 200, body: { slow: true } }).delay(50);

      const start = Date.now();
      await fetchJson(`${baseUrl}/api/slow`);
      const duration = Date.now() - start;

      expect(duration).toBeGreaterThanOrEqual(45);
    });
  });

  describe("request logging", () => {
    it("should log requests", async () => {
      server.respond("/api/test", { status: 200, body: {} });

      await fetchJson(`${baseUrl}/api/test`);
      await fetchJson(`${baseUrl}/api/test`, { method: "POST" });

      const requests = server.getRequests();

      expect(requests).toHaveLength(2);
      expect(requests[0].path).toBe("/api/test");
      expect(requests[0].method).toBe("GET");
      expect(requests[1].method).toBe("POST");
    });
  });

  describe("reset", () => {
    it("should clear routes and logs", async () => {
      server.respond("/api/test", { status: 200, body: {} });
      await fetchJson(`${baseUrl}/api/test`);

      server.reset();

      const result = await fetchJson(`${baseUrl}/api/test`);
      expect(result.status).toBe(404);
      expect(server.getRequests()).toHaveLength(1);
    });
  });
});

describe("createMockServer", () => {
  it("should create and start server", async () => {
    const { server, port, url } = await createMockServer();

    expect(port).toBeGreaterThan(0);
    expect(url).toBe(`http://localhost:${port}`);

    await server.stop();
  });
});
