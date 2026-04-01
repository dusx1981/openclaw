import { afterAll, afterEach, beforeAll, vi } from "vitest";

process.env.VITEST = "true";

const TEST_PROCESS_MAX_LISTENERS = 128;
if (process.getMaxListeners() > 0 && process.getMaxListeners() < TEST_PROCESS_MAX_LISTENERS) {
  process.setMaxListeners(TEST_PROCESS_MAX_LISTENERS);
}

afterEach(() => {
  if (vi.isFakeTimers()) {
    vi.useRealTimers();
  }
});
