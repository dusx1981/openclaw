import type { Platform } from "../../domain/types.js";

export interface SessionStickinessConfig {
  platform: Platform;
  ttlMs?: number;
}

export interface StickySession {
  sessionId: string;
  platform: Platform;
  preferredSourceId: string;
  createdAt: number;
  expiresAt: number;
  requestCount: number;
}

export class SessionStickiness {
  private sessions: Map<string, StickySession> = new Map();
  private defaultTtlMs: number;

  constructor(config?: { defaultTtlMs?: number }) {
    this.defaultTtlMs = config?.defaultTtlMs ?? 30 * 60 * 1000; // 30 minutes
  }

  getOrCreateSession(
    sessionId: string,
    platform: Platform,
    availableSources: string[],
  ): StickySession | null {
    const existing = this.sessions.get(sessionId);

    if (existing && !this.isExpired(existing)) {
      existing.requestCount++;
      return existing;
    }

    if (availableSources.length === 0) {
      return null;
    }

    const now = Date.now();
    const session: StickySession = {
      sessionId,
      platform,
      preferredSourceId: availableSources[0],
      createdAt: now,
      expiresAt: now + this.defaultTtlMs,
      requestCount: 1,
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): StickySession | undefined {
    const session = this.sessions.get(sessionId);
    if (!session || this.isExpired(session)) {
      this.sessions.delete(sessionId);
      return undefined;
    }
    return session;
  }

  updatePreferredSource(sessionId: string, sourceId: string): boolean {
    const session = this.sessions.get(sessionId);
    if (!session || this.isExpired(session)) {
      return false;
    }
    session.preferredSourceId = sourceId;
    return true;
  }

  clearSession(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  clearExpiredSessions(): number {
    let cleared = 0;
    for (const [id, session] of this.sessions) {
      if (this.isExpired(session)) {
        this.sessions.delete(id);
        cleared++;
      }
    }
    return cleared;
  }

  getActiveSessionCount(): number {
    let count = 0;
    for (const session of this.sessions.values()) {
      if (!this.isExpired(session)) {
        count++;
      }
    }
    return count;
  }

  private isExpired(session: StickySession): boolean {
    return Date.now() >= session.expiresAt;
  }
}
