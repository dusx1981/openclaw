# @openclaw/meichao-ecom

美潮电商数据采集与智能分析系统 - 支持淘宝、Amazon 等多平台商品数据抓取、价格监控、趋势分析。

## Features

- **多平台支持**: 淘宝、Amazon (可扩展)
- **数据管道**: ETL 过滤器链 (Fetch → Validate → Dedupe → Store → Cache)
- **智能缓存**: Redis 缓存层
- **配额管理**: API 调用跟踪与告警
- **六边形架构**: 领域核心无外部依赖
- **开放搜索降级**: Bing/Tavily 作为最终降级方案

## Configuration

### 开放搜索配置

当主数据源（API/爬虫）不可用时，系统会自动降级到开放搜索。要启用此功能：

```bash
# Bing Search API（免费层 1000 次/月）
# 获取密钥: https://azure.microsoft.com/en-us/services/cognitive-services/bing-web-search-api/
export BING_API_KEY="your-bing-api-key"

# 可选：Bing Custom Search 配置 ID（用于优化购物结果）
export BING_CUSTOM_CONFIG_ID="your-config-id"
```

Tavily 搜索通过 OpenClaw 的 tavily 插件配置，参见 `plugins.entries.tavily.config.webSearch.apiKey`。

## Quick Start

```bash
# 启动基础设施
docker-compose up -d

# 运行测试
pnpm test

# 运行 benchmark
pnpm bench
```

## Testing

### 独立测试

本扩展支持独立运行测试：

```bash
cd extensions/meichao-ecom
pnpm test                    # 运行所有测试
pnpm test:watch             # 监视模式
pnpm test:coverage          # 覆盖率报告
```

### 通过 Wrapper 测试

也可以通过 OpenClaw wrapper 运行：

```bash
pnpm test -- extensions/meichao-ecom
```

### 集成测试

集成测试需要环境变量控制（需要 Docker）：

```bash
OPENCLAW_MEICHAO_INTEGRATION=1 pnpm test
```

### 特殊测试

```bash
OPENCLAW_MEICHAO_STRESS=1 pnpm test:stress
OPENCLAW_MEICHAO_CHAOS=1 pnpm test:chaos
```

### 版本同步

**重要**: 本扩展使用独立的 vitest 依赖，版本必须与 root 保持一致：

- Root: `vitest ^4.1.2`
- Extension: `vitest ^4.1.2`

升级 root vitest 时，需要同步更新本扩展的 `package.json`。

## Architecture

```
src/
├── domain/           # 领域层 (M1)
│   ├── types.ts
│   ├── entities/
│   ├── value-objects/
│   └── ports/
├── infrastructure/   # 基础设施层 (M2-M4)
│   ├── storage/      # PostgreSQL
│   ├── cache/        # Redis
│   ├── adapters/     # 平台适配器
│   └── registry/
└── application/      # 应用层 (M5-M6)
    ├── pipeline/     # 数据管道
    ├── use-cases/
    └── services/
```

## Usage

```typescript
import { initializePlatform, getPipeline } from "@openclaw/meichao-ecom";

// 初始化
await initializePlatform();

// 执行管道
const pipeline = getPipeline();
const result = await pipeline.execute("taobao", ["12345", "67890"]);

console.log(result.stats);
```

## Documentation

- [完整文档](../../docs/dev/meichao-ecom-data-collection.md)
- [调试指南](./DEBUGGING.md)
- [Benchmark 报告](./BENCHMARK.md)
- [测试报告](./TEST_REPORT.md)

## Test Coverage

```
Test Files: 21 passed
Tests: 220 passed
```

## License

MIT
