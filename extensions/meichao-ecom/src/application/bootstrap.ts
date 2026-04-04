import { Alibaba1688Adapter } from "../infrastructure/adapters/Alibaba1688Adapter.js";
import { AliExpressAdapter } from "../infrastructure/adapters/AliExpressAdapter.js";
import { AmazonAdapter } from "../infrastructure/adapters/AmazonAdapter.js";
import { DouyinAdapter } from "../infrastructure/adapters/DouyinAdapter.js";
import { JDAdapter } from "../infrastructure/adapters/JDAdapter.js";
import { LazadaAdapter } from "../infrastructure/adapters/LazadaAdapter.js";
import { PinduoduoAdapter } from "../infrastructure/adapters/PinduoduoAdapter.js";
import { ShopeeAdapter } from "../infrastructure/adapters/ShopeeAdapter.js";
import { TaobaoAdapter } from "../infrastructure/adapters/TaobaoAdapter.js";
import { TaoGongChangAdapter } from "../infrastructure/adapters/TaoGongChangAdapter.js";
import { TikTokShopAdapter } from "../infrastructure/adapters/TikTokShopAdapter.js";
import { TmallAdapter } from "../infrastructure/adapters/TmallAdapter.js";
import { TumeAdapter } from "../infrastructure/adapters/TumeAdapter.js";
import { RedisCacheProvider } from "../infrastructure/cache/CacheProvider.js";
import { PlatformRegistry } from "../infrastructure/registry/PlatformRegistry.js";
import { PostgresProductRepository } from "../infrastructure/storage/ProductRepository.js";
import { Container } from "./Container.js";
import { AlertService } from "./services/AlertService.js";
import { FetchProductUseCase } from "./use-cases/FetchProductUseCase.js";
import { SearchProductsUseCase } from "./use-cases/SearchProductsUseCase.js";

export interface MeichaoEcomConfig {
  postgres?: {
    host?: string;
    port?: number;
    database?: string;
    user?: string;
    password?: string;
  };
  redis?: {
    host?: string;
    port?: number;
    password?: string;
  };
  alertChannels?: Array<{
    type: "feishu" | "email" | "webhook";
    config: Record<string, unknown>;
  }>;
}

let initialized = false;

export async function initializePlatform(config?: MeichaoEcomConfig): Promise<void> {
  if (initialized) {
    return;
  }

  const taobaoAdapter = TaobaoAdapter.create();
  const amazonAdapter = AmazonAdapter.create();
  const alibaba1688Adapter = Alibaba1688Adapter.create();
  const jdAdapter = JDAdapter.create();
  const pinduoduoAdapter = PinduoduoAdapter.create();
  const douyinAdapter = DouyinAdapter.create();
  const shopeeAdapter = ShopeeAdapter.create();
  const aliexpressAdapter = AliExpressAdapter.create();
  const tiktokShopAdapter = TikTokShopAdapter.create();
  const lazadaAdapter = LazadaAdapter.create();
  const tumeAdapter = TumeAdapter.create();
  const tmallAdapter = TmallAdapter.create();
  const taogongchangAdapter = TaoGongChangAdapter.create();

  PlatformRegistry.register(taobaoAdapter);
  PlatformRegistry.register(amazonAdapter);
  PlatformRegistry.register(alibaba1688Adapter);
  PlatformRegistry.register(jdAdapter);
  PlatformRegistry.register(pinduoduoAdapter);
  PlatformRegistry.register(douyinAdapter);
  PlatformRegistry.register(shopeeAdapter);
  PlatformRegistry.register(aliexpressAdapter);
  PlatformRegistry.register(tiktokShopAdapter);
  PlatformRegistry.register(lazadaAdapter);
  PlatformRegistry.register(tumeAdapter);
  PlatformRegistry.register(tmallAdapter);
  PlatformRegistry.register(taogongchangAdapter);

  const repository = new PostgresProductRepository();
  const cacheProvider = new RedisCacheProvider();

  Container.bind("productRepository", repository);
  Container.bind("cacheProvider", cacheProvider);

  const gateways = PlatformRegistry.getAll();
  Container.bind("gateways", gateways);

  if (config?.alertChannels) {
    AlertService.configure({
      enabled: true,
      channels: config.alertChannels,
      cooldownMinutes: 5,
    });
  }

  initialized = true;
}

export async function shutdownPlatform(): Promise<void> {
  PlatformRegistry.clear();
  Container.clear();
  initialized = false;
}

export function getFetchProductUseCase(platform: string): FetchProductUseCase {
  const gateways = Container.get("gateways");
  const repository = Container.get("productRepository");
  const cacheProvider = Container.get("cacheProvider");

  const gateway = gateways.get(platform as never);
  if (!gateway) {
    throw new Error(`No gateway registered for platform: ${platform}`);
  }

  return new FetchProductUseCase(gateway, repository, cacheProvider);
}

export function getSearchProductsUseCase(platform: string): SearchProductsUseCase {
  const gateways = Container.get("gateways");
  const repository = Container.get("productRepository");

  const gateway = gateways.get(platform as never);
  if (!gateway) {
    throw new Error(`No gateway registered for platform: ${platform}`);
  }

  return new SearchProductsUseCase(gateway, repository);
}

export function getValidatorRegistry() {
  const { ValidatorRegistry } = require("../validation/ValidatorRegistry.js");
  return ValidatorRegistry.getInstance();
}

export function isPlatformInitialized(): boolean {
  return initialized;
}
