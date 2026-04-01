## Context

meichao-ecom 插件需要连接 PostgreSQL 和 Redis，当前架构存在配置断层：

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  openclaw       │     │  .env 文件      │     │  代码默认值      │
│  config.json    │     │  (未被加载)     │     │  (硬编码)        │
│                 │     │                 │     │                 │
│  pluginConfig:  │     │  PORT=5434      │     │  port: 5432     │
│  未被使用        │     │                 │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

OpenClaw 插件 API 提供 `api.pluginConfig` 字段，允许在插件注册时注入配置。`openclaw.plugin.json` 已定义 `configSchema`，但代码未读取。

## Goals / Non-Goals

**Goals:**
- 通过 `api.pluginConfig` 注入 postgres/redis 配置
- 保留环境变量作为 fallback，确保向后兼容
- 使用户可以通过 OpenClaw CLI 或 Web UI 配置数据库连接
- 默认端口改为与 Docker 配置匹配（5434/6380）

**Non-Goals:**
- 不改变 openclaw.plugin.json 的 configSchema 结构（已定义）
- 不引入新的外部依赖
- 不修改现有 API 行为

## Decisions

### 1. 配置注入方式：全局配置模块

**决定:** 创建 `plugin-config.ts` 模块，使用 setter 注入配置，getter 获取合并后的配置。

**理由:**
- postgres.ts 和 redis.ts 是独立模块，无法直接访问 `api` 对象
- 配置模块提供统一入口，避免重复逻辑
- setter/getter 模式简单，不引入复杂的依赖注入框架

**替代方案:**
- 直接在 postgres.ts/redis.ts 中读取 process.env（现状，不够灵活）
- 使用构造函数注入（需要重构现有代码）

### 2. 配置优先级

**决定:** `pluginConfig > process.env > 默认值`

**理由:**
- 用户显式配置优先级最高
- 环境变量作为 fallback 确保向后兼容
- 默认值匹配 Docker 配置

### 3. 默认端口修改

**决定:** 修改代码默认值为 5434/6380

**理由:**
- Docker compose 已配置这些端口
- 避免与系统服务冲突
- 新用户开箱即用

## Risks / Trade-offs

**[Risk] 配置注入时序问题**
→ Mitigation: 在 `register()` 最开始注入配置，确保后续代码使用正确值

**[Risk] 多次调用 setter 导致配置不一致**
→ Mitigation: 配置模块内部使用 `Object.freeze()` 冻结已注入的配置

**[Risk] 测试覆盖**
→ Mitigation: 为配置模块添加单元测试，验证优先级逻辑

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              配置加载流程                                    │
└─────────────────────────────────────────────────────────────────────────────┘

  OpenClaw 启动
       │
       ▼
  加载 openclaw.plugin.json
       │
       ▼
  读取用户配置 (config.json / CLI / Web UI)
       │
       ▼
  调用 register(api)
       │
       ├── api.pluginConfig.postgres
       │         │
       │         ▼
       │   setPostgresConfig(api.pluginConfig.postgres)
       │         │
       │         ▼
       │   plugin-config.ts 内部合并:
       │   { ...默认值, ...env, ...pluginConfig }
       │
       └── api.pluginConfig.redis
                 │
                 ▼
           setRedisConfig(api.pluginConfig.redis)
                 │
                 ▼
           plugin-config.ts 内部合并

  后续代码调用:
       │
       ▼
  getPostgresConfig() → 返回最终配置
  getRedisConfig()    → 返回最终配置
```

## File Changes

```
extensions/meichao-ecom/
├── src/
│   └── infrastructure/
│       └── config/
│           └── plugin-config.ts    (新建)
├── src/
│   └── infrastructure/
│       ├── storage/
│       │   └── postgres.ts         (修改: 使用 plugin-config)
│       └── cache/
│           └── redis.ts            (修改: 使用 plugin-config)
└── index.ts                        (修改: 注入配置)
```