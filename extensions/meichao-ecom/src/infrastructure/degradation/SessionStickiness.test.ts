import { describe, it, expect, beforeEach } from "vitest";
import { SessionStickiness } from "./SessionStickiness.js";

describe("SessionStickiness", () => {
  let stickiness: SessionStickiness;

  beforeEach(() => {
    stickiness = new SessionStickiness({ defaultTtlMs: 1000 });
  });

  describe("getOrCreateSession", () => {
    it("should create new session if not exists", () => {
      const sources = ["taobao_official_api", "taobao_third_party_api"];
      const session = stickiness.getOrCreateSession("session-1", "taobao", sources);

      expect(session).toBeDefined();
      expect(session?.sessionId).toBe("session-1");
      expect(session?.platform).toBe("taobao");
      expect(session?.preferredSourceId).toBe("taobao_official_api");
      expect(session?.requestCount).toBe(1);
    });

    it("should return existing session if not expired", () => {
      const sources = ["taobao_official_api", "taobao_third_party_api"];

      const session1 = stickiness.getOrCreateSession("session-1", "taobao", sources);
      const session2 = stickiness.getOrCreateSession("session-1", "taobao", sources);

      expect(session2?.requestCount).toBe(2);
      expect(session2?.createdAt).toBe(session1?.createdAt);
    });

    it("should create new session if expired", async () => {
      const sources = ["taobao_official_api", "taobao_third_party_api"];

      stickiness.getOrCreateSession("session-1", "taobao", sources);

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const session = stickiness.getOrCreateSession("session-1", "taobao", sources);

      expect(session?.requestCount).toBe(1);
    });

    it("should return null if no sources available", () => {
      const session = stickiness.getOrCreateSession("session-1", "taobao", []);
      expect(session).toBeNull();
    });
  });

  describe("getSession", () => {
    it("should return session if exists and not expired", () => {
      const sources = ["taobao_official_api"];
      stickiness.getOrCreateSession("session-1", "taobao", sources);

      const session = stickiness.getSession("session-1");

      expect(session).toBeDefined();
      expect(session?.sessionId).toBe("session-1");
    });

    it("should return undefined if not exists", () => {
      const session = stickiness.getSession("non-existent");
      expect(session).toBeUndefined();
    });

    it("should return undefined and delete if expired", async () => {
      const sources = ["taobao_official_api"];
      stickiness.getOrCreateSession("session-1", "taobao", sources);

      await new Promise((resolve) => setTimeout(resolve, 1100));

      const session = stickiness.getSession("session-1");

      expect(session).toBeUndefined();
    });
  });

  describe("updatePreferredSource", () => {
    it("should update preferred source for active session", () => {
      const sources = ["taobao_official_api", "taobao_third_party_api"];
      stickiness.getOrCreateSession("session-1", "taobao", sources);

      const updated = stickiness.updatePreferredSource("session-1", "taobao_third_party_api");

      expect(updated).toBe(true);
      expect(stickiness.getSession("session-1")?.preferredSourceId).toBe("taobao_third_party_api");
    });

    it("should return false for non-existent session", () => {
      const updated = stickiness.updatePreferredSource("non-existent", "taobao_official_api");
      expect(updated).toBe(false);
    });
  });

  describe("clearSession", () => {
    it("should remove session", () => {
      const sources = ["taobao_official_api"];
      stickiness.getOrCreateSession("session-1", "taobao", sources);

      stickiness.clearSession("session-1");

      expect(stickiness.getSession("session-1")).toBeUndefined();
    });
  });

  describe("clearExpiredSessions", () => {
    it("should clear expired sessions only", async () => {
      const sources = ["taobao_official_api"];

      stickiness.getOrCreateSession("session-1", "taobao", sources);
      stickiness.getOrCreateSession("session-2", "taobao", sources);

      await new Promise((resolve) => setTimeout(resolve, 1100));

      stickiness.getOrCreateSession("session-3", "taobao", sources);

      const cleared = stickiness.clearExpiredSessions();

      expect(cleared).toBe(2);
      expect(stickiness.getActiveSessionCount()).toBe(1);
    });
  });

  describe("getActiveSessionCount", () => {
    it("should count only non-expired sessions", async () => {
      const sources = ["taobao_official_api"];

      stickiness.getOrCreateSession("session-1", "taobao", sources);
      stickiness.getOrCreateSession("session-2", "taobao", sources);

      await new Promise((resolve) => setTimeout(resolve, 600));

      stickiness.getOrCreateSession("session-3", "taobao", sources);

      await new Promise((resolve) => setTimeout(resolve, 600));

      expect(stickiness.getActiveSessionCount()).toBe(1);
    });
  });
});
