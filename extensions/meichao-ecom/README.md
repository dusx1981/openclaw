# @openclaw/meichao-ecom

美潮电商数据采集与智能分析系统 - 支持淘宝、Amazon 等多平台商品数据抓取、价格监控、趋势分析。

## Features

- **多平台支持**: 淘宝、Amazon (可扩展)
- **数据管道**: ETL 过滤器链 (Fetch → Validate → Dedupe → Store → Cache)
- **智能缓存**: Redis 缓存层
- **配额管理**: API 调用跟踪与告警
- **六边形架构**: 领域核心无外部依赖

## Quick Start

```bash
# 启动基础设施
docker-compose up -d

# 运行测试
pnpm test

# 运行 benchmark
pnpm bench
```

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
