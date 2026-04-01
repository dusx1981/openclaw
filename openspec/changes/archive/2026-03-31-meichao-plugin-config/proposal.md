## Why

meichao-ecom 插件目前使用硬编码的默认端口（PostgreSQL: 5432, Redis: 6379），但 Docker 配置使用非标准端口（PostgreSQL: 5434, Redis: 6380）以避免与系统服务冲突。这导致插件无法连接到数据库，因为 OpenClaw 运行时不会自动加载插件的 `.env` 文件。

OpenClaw 插件 API 已经提供了 `api.pluginConfig` 字段用于注入配置，但 meichao-ecom 没有使用它。本变更将实现正确的配置注入机制，使用户可以通过 OpenClaw 的配置系统管理数据库连接参数。

## What Changes

- 新增配置模块 `src/infrastructure/config/plugin-config.ts`，用于接收和管理插件配置
- 修改 `postgres.ts` 和 `redis.ts`，支持从配置模块获取连接参数
- 修改插件入口 `index.ts`，在 `register()` 中读取 `api.pluginConfig` 并注入配置
- 更新 `.env.example` 默认端口为 Docker 配置匹配的端口
- 保留环境变量作为 fallback，确保向后兼容

## Capabilities

### New Capabilities

- `plugin-config-injection`: 插件配置注入机制，允许通过 OpenClaw 配置系统注入数据库连接参数

### Modified Capabilities

无。本变更仅影响内部配置加载机制，不改变外部 API 或行为。

## Impact

**代码变更:**
- `extensions/meichao-ecom/src/infrastructure/config/plugin-config.ts` (新建)
- `extensions/meichao-ecom/src/infrastructure/storage/postgres.ts` (修改)
- `extensions/meichao-ecom/src/infrastructure/cache/redis.ts` (修改)
- `extensions/meichao-ecom/index.ts` (修改)
- `extensions/meichao-ecom/.env.example` (修改默认端口)

**依赖:**
- 无新增外部依赖
- 依赖 OpenClaw 插件 API 的 `pluginConfig` 字段

**向后兼容:**
- 环境变量仍然作为 fallback
- 如果用户未配置 `pluginConfig`，使用默认值