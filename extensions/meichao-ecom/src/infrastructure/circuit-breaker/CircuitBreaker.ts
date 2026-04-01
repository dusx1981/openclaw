import {
  CircuitBreakerState,
  CircuitBreakerConfig,
  DEFAULT_CIRCUIT_BREAKER_CONFIG,
} from "../../domain/types.js";

export class CircuitBreaker {
  private state: CircuitBreakerState = "closed";
  private failureCount = 0;
  private successCount = 0;
  private lastFailureTime?: number;
  private halfOpenCallCount = 0;
  private readonly config: Required<CircuitBreakerConfig>;

  constructor(config: Partial<CircuitBreakerConfig> = {}) {
    this.config = {
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      ...config,
    };
  }

  getState(): CircuitBreakerState {
    this.checkStateTransition();
    return this.state;
  }

  getFailureCount(): number {
    return this.failureCount;
  }

  getSuccessCount(): number {
    return this.successCount;
  }

  canExecute(): boolean {
    this.checkStateTransition();

    switch (this.state) {
      case "closed":
        return true;
      case "open":
        return false;
      case "half-open":
        return this.halfOpenCallCount < this.config.halfOpenMaxCalls;
      default:
        return false;
    }
  }

  recordSuccess(): void {
    this.successCount++;

    if (this.state === "half-open") {
      this.halfOpenCallCount++;
      if (this.halfOpenCallCount >= this.config.successThreshold) {
        this.transitionTo("closed");
      }
    } else if (this.state === "closed") {
      this.failureCount = 0;
    }
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === "half-open") {
      this.transitionTo("open");
    } else if (this.state === "closed" && this.failureCount >= this.config.failureThreshold) {
      this.transitionTo("open");
    }
  }

  reset(): void {
    this.state = "closed";
    this.failureCount = 0;
    this.successCount = 0;
    this.halfOpenCallCount = 0;
    this.lastFailureTime = undefined;
  }

  private checkStateTransition(): void {
    if (this.state === "open" && this.lastFailureTime) {
      const elapsed = Date.now() - this.lastFailureTime;
      if (elapsed >= this.config.openDuration) {
        this.transitionTo("half-open");
      }
    }
  }

  private transitionTo(newState: CircuitBreakerState): void {
    const previousState = this.state;
    this.state = newState;

    if (newState === "closed") {
      this.failureCount = 0;
      this.halfOpenCallCount = 0;
    } else if (newState === "half-open") {
      this.halfOpenCallCount = 0;
    } else if (newState === "open") {
      this.halfOpenCallCount = 0;
    }
  }
}
