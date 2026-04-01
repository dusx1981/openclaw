import { definePluginEntry, type AnyAgentTool, type OpenClawPluginApi } from "./runtime-api.js";
import { registerMeichaoCli } from "./src/cli/index.js";
import type { RedisConfig } from "./src/infrastructure/cache/redis.js";
import { setPostgresConfig, setRedisConfig } from "./src/infrastructure/config/plugin-config.js";
import type { PostgresConfig } from "./src/infrastructure/storage/postgres.js";
import { createProductFetchTool } from "./src/tools/product-fetch-tool.js";
import { createProductSearchTool } from "./src/tools/product-search-tool.js";
import { createValidatePlatformTool } from "./src/tools/validate-platform-tool.js";

export default definePluginEntry({
  id: "meichao-ecom",
  name: "Meichao E-commerce",
  description:
    "美潮龙虾跨境电商数据采集与智能分析系统 - 支持淘宝、Amazon等平台的商品数据获取、搜索和验证",
  register(api: OpenClawPluginApi) {
    if (api.pluginConfig?.postgres) {
      setPostgresConfig(api.pluginConfig.postgres as Partial<PostgresConfig>);
    }
    if (api.pluginConfig?.redis) {
      setRedisConfig(api.pluginConfig.redis as Partial<RedisConfig>);
    }

    api.registerTool(createProductFetchTool(api) as unknown as AnyAgentTool);
    api.registerTool(createProductSearchTool(api) as unknown as AnyAgentTool);
    api.registerTool(createValidatePlatformTool(api) as unknown as AnyAgentTool);
    api.registerCli(({ program }) => registerMeichaoCli(program), { commands: ["meichao"] });
  },
});
