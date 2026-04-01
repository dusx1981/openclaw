import { createServer, type Server, type IncomingMessage, type ServerResponse } from "http";

export interface MockResponse {
  status: number;
  body: unknown;
  headers?: Record<string, string>;
}

export interface MockRoute {
  path: string | RegExp;
  method: string;
  response: MockResponse | MockResponse[];
  currentIndex: number;
}

export interface MockServerOptions {
  port?: number;
}

export class MockServer {
  private server: Server | null = null;
  private routes: MockRoute[] = [];
  private port: number;
  private requestLog: { method: string; path: string; timestamp: number }[] = [];

  constructor(options: MockServerOptions = {}) {
    this.port = options.port ?? 0;
  }

  async start(): Promise<{ port: number; url: string }> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.listen(this.port, () => {
        const address = this.server!.address();
        if (typeof address === "object" && address !== null) {
          this.port = address.port;
          resolve({ port: this.port, url: `http://localhost:${this.port}` });
        } else {
          reject(new Error("Failed to get server port"));
        }
      });

      this.server.on("error", reject);
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.server = null;
          resolve();
        }
      });
    });
  }

  respond(
    path: string | RegExp,
    response: MockResponse | MockResponse[],
    method: string = "GET",
  ): this {
    this.routes.push({
      path,
      method: method.toUpperCase(),
      response,
      currentIndex: 0,
    });
    return this;
  }

  error(path: string | RegExp, status: number = 500, method: string = "GET"): this {
    return this.respond(path, { status, body: { error: "Mock error" } }, method);
  }

  delay(ms: number): this {
    const originalRoutes = [...this.routes];
    this.routes = originalRoutes.map((route) => {
      const originalResponse = route.response;
      return {
        ...route,
        response: Array.isArray(originalResponse)
          ? originalResponse.map((r) => ({ ...r, delay: ms }))
          : { ...originalResponse, delay: ms },
      };
    });
    return this;
  }

  getRequests(): { method: string; path: string; timestamp: number }[] {
    return [...this.requestLog];
  }

  reset(): void {
    this.routes = [];
    this.requestLog = [];
    this.routes.forEach((route) => {
      route.currentIndex = 0;
    });
  }

  getUrl(): string {
    return `http://localhost:${this.port}`;
  }

  private handleRequest(req: IncomingMessage, res: ServerResponse): void {
    const path = req.url || "/";
    const method = req.method || "GET";

    this.requestLog.push({
      method,
      path,
      timestamp: Date.now(),
    });

    const route = this.findRoute(path, method);

    if (!route) {
      res.writeHead(404, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Not found" }));
      return;
    }

    const response = this.getResponse(route);

    const delay = (response as { delay?: number }).delay || 0;

    setTimeout(() => {
      const headers = {
        "Content-Type": "application/json",
        ...response.headers,
      };

      res.writeHead(response.status, headers);
      res.end(JSON.stringify(response.body));
    }, delay);
  }

  private findRoute(path: string, method: string): MockRoute | undefined {
    return this.routes.find(
      (route) =>
        route.method === method &&
        (typeof route.path === "string" ? route.path === path : route.path.test(path)),
    );
  }

  private getResponse(route: MockRoute): MockResponse {
    if (Array.isArray(route.response)) {
      const response = route.response[route.currentIndex];
      route.currentIndex = (route.currentIndex + 1) % route.response.length;
      return response;
    }
    return route.response;
  }
}

export async function createMockServer(
  options?: MockServerOptions,
): Promise<{ server: MockServer; port: number; url: string }> {
  const server = new MockServer(options);
  const { port, url } = await server.start();
  return { server, port, url };
}
