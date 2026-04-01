# Meichao-Ecom VSCode 调试指南

## 快速开始

### 1. 调试单个测试文件

在 VSCode 中打开任意测试文件，按 `F5` 或点击"运行和调试"面板，选择：

- **Debug: Meichao Single Test** - 调试当前文件
- **Debug: Meichao Watch Mode** - 监视模式，文件变化自动重跑

### 2. 运行调试脚本

```bash
# 运行完整调试流程
bun scripts/debug-meichao.ts

# 运行测试场景
bun scripts/debug-meichao.ts --test

# 详细输出
bun scripts/debug-meichao.ts --trace
```

### 3. 命令行调试

```bash
# 调试单个测试
pnpm vitest run extensions/meichao-ecom/src/infrastructure/__tests__/TaobaoAdapter.degradation.test.ts --no-threads

# 监视模式
pnpm vitest watch extensions/meichao-ecom/src/ --no-threads

# 详细输出
pnpm vitest run extensions/meichao-ecom/src/ --reporter=verbose
```

---

## VSCode 调试配置说明

配置文件：`.vscode/launch.json`

| 配置名称                        | 用途                       | 快捷键 |
| ------------------------------- | -------------------------- | ------ |
| Debug: Meichao Single Test      | 调试当前打开的测试文件     | F5     |
| Debug: Meichao All Tests        | 运行所有 meichao-ecom 测试 | -      |
| Debug: Meichao Degradation Test | 调试降级测试（详细输出）   | -      |
| Debug: Meichao Watch Mode       | 监视模式                   | -      |
| Debug: Run TypeScript File      | 直接运行 TS 文件           | -      |

---

## 调试技巧

### 断点调试

1. 在测试文件中设置断点（点击行号左侧）
2. 按 F5 启动调试
3. 使用调试面板查看变量、调用栈

### 使用 debug 语句

```typescript
// 在测试或源码中添加
debugger; // 代码会在此处暂停

// 或使用 console.log
console.log("当前状态:", adapter);
```

### 查看数据源状态

```typescript
// 在调试时执行
const sources = await adapter.getAvailableDataSources();
console.log("可用数据源:", sources);
```

### 追踪降级流程

```typescript
// 运行详细降级测试
pnpm vitest run extensions/meichao-ecom/src/infrastructure/__tests__/TaobaoAdapter.degradation.test.ts --reporter=verbose
```

---

## 测试场景覆盖

### 场景 1: 基础商品获取

```
所有数据源可用 → 使用主数据源 → 返回成功
```

### 场景 2: 故障转移

```
主数据源不可用 → 切换备用源 → 标记降级
```

### 场景 3: 配置覆盖

```
自定义 sourceConfig → 使用配置的 primary → fallback
```

### 场景 4: 全部失败

```
所有数据源不可用 → 返回错误
```

### 场景 5: 跨适配器

```
AmazonAdapter 独立测试
```

---

## 日志级别控制

```bash
# 启用调试日志
OPENCLAW_LOG_LEVEL=debug pnpm vitest run ...

# 启用追踪日志
OPENCLAW_LOG_LEVEL=trace pnpm vitest run ...

# 启用文件日志
OPENCLAW_TEST_FILE_LOG=1 pnpm vitest run ...
```

---

## 常见问题

### Q: 测试超时怎么办？

```bash
# 增加超时时间
pnpm vitest run ... --test-timeout=60000
```

### Q: 如何只运行特定测试？

```bash
# 按测试名称过滤
pnpm vitest run ... -t "should fallback"
```

### Q: 如何查看测试覆盖率？

```bash
pnpm vitest run extensions/meichao-ecom/src/ --coverage
```

### Q: 如何调试异步代码？

使用 `await` 和断点，或添加 `debugger;` 语句：

```typescript
it("async test", async () => {
  const result = await adapter.fetchProduct("123");
  debugger; // 在此处暂停
  expect(result.success).toBe(true);
});
```

---

## 扩展调试

### 自定义调试脚本

创建 `scripts/debug-meichao.ts`:

```typescript
import { TaobaoAdapter } from "../extensions/meichao-ecom/src/infrastructure/adapters/TaobaoAdapter.js";

const adapter = TaobaoAdapter.create();
const result = await adapter.fetchProduct("12345");
console.log(result);
```

运行：

```bash
bun scripts/debug-meichao.ts
```

### 使用 VSCode 调试控制台

在调试时，可以在"调试控制台"中执行代码：

```javascript
// 查看当前变量
adapter.getAvailableDataSources();

// 修改状态
adapter.updateDataSource("taobao_official_api", { isAvailable: false });
```
