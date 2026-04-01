import type { CacheProvider } from "../domain/ports/CacheProvider.js";
import type { PlatformGateway } from "../domain/ports/PlatformGateway.js";
import type { ProductRepository } from "../domain/ports/ProductRepository.js";
import type { Platform } from "../domain/types.js";

export interface ContainerBindings {
  productRepository: ProductRepository;
  cacheProvider: CacheProvider;
  gateways: Map<Platform, PlatformGateway>;
}

class ContainerImpl {
  private bindings: Partial<ContainerBindings> = {};
  private singletons: Map<string, unknown> = new Map();

  bind<K extends keyof ContainerBindings>(key: K, value: ContainerBindings[K]): void {
    this.bindings[key] = value;
  }

  get<K extends keyof ContainerBindings>(key: K): ContainerBindings[K] {
    const value = this.bindings[key];
    if (value === undefined) {
      throw new Error(`Binding not found: ${key}`);
    }
    return value;
  }

  has(key: keyof ContainerBindings): boolean {
    return key in this.bindings;
  }

  singleton<T>(key: string, factory: () => T): T {
    if (this.singletons.has(key)) {
      return this.singletons.get(key) as T;
    }
    const instance = factory();
    this.singletons.set(key, instance);
    return instance;
  }

  clear(): void {
    this.bindings = {};
    this.singletons.clear();
  }
}

export const Container = new ContainerImpl();
