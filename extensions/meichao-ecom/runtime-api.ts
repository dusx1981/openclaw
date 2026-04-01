export {
  definePluginEntry,
  emptyPluginConfigSchema,
  stringEnum,
  optionalStringEnum,
} from "openclaw/plugin-sdk/meichao-ecom";
export type {
  AnyAgentTool,
  OpenClawPluginApi,
  OpenClawPluginToolContext,
  PluginLogger,
} from "openclaw/plugin-sdk/meichao-ecom";
export { initializePlatform, shutdownPlatform } from "./src/application/bootstrap.js";
export { PlatformRegistry } from "./src/infrastructure/registry/PlatformRegistry.js";
export { getFetchProductUseCase, getSearchProductsUseCase } from "./src/application/bootstrap.js";
export type { Platform, ProductData } from "./src/domain/types.js";
export { registerMeichaoCli } from "./src/cli/index.js";
