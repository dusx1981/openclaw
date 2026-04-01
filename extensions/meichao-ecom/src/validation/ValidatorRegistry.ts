import type { Platform } from "../domain/types.js";
import { AmazonValidator } from "./AmazonValidator.js";
import type { PlatformValidator } from "./PlatformValidator.js";
import { TaobaoValidator } from "./TaobaoValidator.js";

class ValidatorRegistryImpl {
  private validators: Map<Platform, PlatformValidator> = new Map();

  constructor() {
    this.register("taobao", new TaobaoValidator());
    this.register("amazon", new AmazonValidator());
  }

  register(platform: Platform, validator: PlatformValidator): void {
    this.validators.set(platform, validator);
  }

  get(platform: Platform): PlatformValidator | undefined {
    return this.validators.get(platform);
  }

  has(platform: Platform): boolean {
    return this.validators.has(platform);
  }

  getAllPlatforms(): Platform[] {
    return Array.from(this.validators.keys());
  }

  getAllValidators(): Map<Platform, PlatformValidator> {
    return new Map(this.validators);
  }
}

export const ValidatorRegistry = new ValidatorRegistryImpl();
