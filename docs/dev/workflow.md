---
summary: "OpenClaw 开发工作流程和调试指南"
title: "开发工作流"
---

# 开发工作流

本指南介绍 OpenClaw 的开发工作流程、调试技巧和最佳实践。

## 开发环境设置

### 推荐工具

| 工具 | 用途 |
|------|------|
| VS Code | 代码编辑器 |
| Node.js 22+ | 运行时环境 |
| pnpm | 包管理器 |

### VS Code 扩展推荐

- ESLint
- Oxlint
- TypeScript

## 开发流程

### 1. 创建功能分支

```bash
git checkout -b feature/your-feature-name
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 开发循环

```bash
# 终端 1：启动 Gateway（带热重载）
pnpm gateway:watch

# 终端 2：运行测试
pnpm test:watch

# 终端 3：运行 Lint
pnpm lint
```

### 4. 提交代码

```bash
# 格式化代码
pnpm format

# 运行检查
pnpm check

# 提交
git add .
git commit -m "feat: your feature description"
```

## 调试技巧

### Gateway 调试

#### 启用详细日志

```bash
# 命令行方式
pnpm openclaw gateway run --verbose

# 或使用环境变量
DEBUG=openclaw:* pnpm openclaw gateway run
```

#### 查看 Gateway 状态

```bash
# 基础状态
pnpm openclaw gateway status

# 深度诊断
pnpm openclaw gateway status --deep

# 包含 RPC 测试
pnpm openclaw gateway status --deep --require-rpc
```

#### 检查 WebSocket 连接

```bash
# 使用 websocat 测试
websocat ws://127.0.0.1:18789

# 或使用 curl
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Key: test" -H "Sec-WebSocket-Version: 13" http://127.0.0.1:18789
```

### 频道调试

#### Telegram

```bash
# 检查 Bot Token
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getMe"

# 获取更新
curl "https://api.telegram.org/bot<YOUR_TOKEN>/getUpdates"
```

#### Discord

```bash
# 检查频道状态
pnpm openclaw channels status --channel discord
```

#### WhatsApp

```bash
# 查看会话文件
ls -la ~/.openclaw/credentials/whatsapp-*/

# 重新登录
pnpm openclaw channels logout --channel whatsapp
pnpm openclaw channels login --channel whatsapp
```

### 日志查看

#### macOS

```bash
# 使用 clawlog 脚本
./scripts/clawlog.sh

# 实时查看
./scripts/clawlog.sh --follow

# 过滤特定分类
./scripts/clawlog.sh --category gateway
```

#### Linux / WSL

```bash
# 查看 systemd 日志
journalctl --user -u openclaw-gateway -f

# 查看进程日志
tail -f ~/.openclaw/logs/gateway.log
```

### 常见问题排查

#### 端口被占用

```bash
# 查找占用进程
lsof -i :18789

# 终止进程
kill -9 <PID>

# 或使用 Gateway 命令
pnpm openclaw gateway stop
```

#### 依赖问题

```bash
# 清理依赖
rm -rf node_modules pnpm-lock.yaml

# 重新安装
pnpm install

# 如果还有问题，尝试清理 pnpm 缓存
pnpm store prune
```

#### TypeScript 错误

```bash
# 清理构建产物
rm -rf dist

# 重新构建
pnpm build

# 如果还有问题，检查 TypeScript 版本
pnpm tsc --version
```

## 测试

### 运行测试

```bash
# 运行所有测试
pnpm test

# 运行特定测试文件
pnpm test -- src/gateway/server.test.ts

# 运行特定测试用例
pnpm test -- -t "should handle WebSocket connection"

# 监听模式
pnpm test:watch

# 覆盖率报告
pnpm test:coverage
```

### 测试分类

| 命令 | 用途 |
|------|------|
| `pnpm test` | 单元测试 |
| `pnpm test:fast` | 快速单元测试 |
| `pnpm test:gateway` | Gateway 测试 |
| `pnpm test:channels` | 频道测试 |
| `pnpm test:e2e` | 端到端测试 |
| `pnpm test:live` | 实时测试（需要真实 API） |
| `pnpm test:docker:all` | Docker 测试 |

### 编写测试

#### 单元测试示例

```typescript
import { describe, it, expect } from "vitest";

describe("MyModule", () => {
  it("should do something", () => {
    expect(true).toBe(true);
  });
});
```

#### 集成测试示例

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";

describe("Gateway Integration", () => {
  beforeAll(async () => {
    // 启动 Gateway
  });

  afterAll(async () => {
    // 关闭 Gateway
  });

  it("should accept WebSocket connections", async () => {
    // 测试逻辑
  });
});
```

## 代码质量

### Lint 检查

```bash
# 运行 Lint
pnpm lint

# 自动修复
pnpm lint:fix

# 特定文件
pnpm lint src/my-file.ts
```

### 格式化

```bash
# 检查格式
pnpm format:check

# 自动格式化
pnpm format

# 格式化特定文件
pnpm format src/my-file.ts
```

### 类型检查

```bash
# TypeScript 类型检查
pnpm tsgo

# 或使用原生 tsc
pnpm exec tsc --noEmit
```

### 完整检查

```bash
# 运行所有检查
pnpm check
```

## 构建和打包

### 开发构建

```bash
# 构建项目
pnpm build

# 监听模式（需要配合其他工具）
# 暂不支持，请使用 pnpm gateway:watch
```

### 生产构建

```bash
# 完整构建
pnpm build

# Docker 构建
pnpm build:docker
```

### macOS 应用打包

```bash
# 打包 macOS 应用
pnpm mac:package

# 打开应用
pnpm mac:open
```

## 发布流程

### 版本更新

1. 更新 `package.json` 版本
2. 更新 `CHANGELOG.md`
3. 运行发布检查：

```bash
pnpm release:check
```

### 创建发布

```bash
# 创建 Git 标签
git tag v2026.M.D

# 推送标签
git push origin v2026.M.D
```

## 扩展开发

### 创建新扩展

```bash
# 在 extensions/ 目录下创建新目录
mkdir -p extensions/my-extension/src

# 创建 package.json
cat > extensions/my-extension/package.json << 'EOF'
{
  "name": "@openclaw/my-extension",
  "version": "1.0.0",
  "main": "dist/index.js",
  "dependencies": {
    "openclaw": "workspace:*"
  }
}
EOF
```

### 扩展结构

```
extensions/my-extension/
├── src/
│   └── index.ts
├── package.json
└── README.md
```

### 扩展开发命令

```bash
# 同步扩展版本
pnpm plugins:sync
```

## 文档开发

### 本地运行文档

```bash
# 启动文档服务器
pnpm docs:dev
```

### 文档结构

```
docs/
├── start/           # 入门指南
├── gateway/         # Gateway 文档
├── channels/        # 频道文档
├── platforms/       # 平台文档
├── tools/           # 工具文档
└── dev/             # 开发文档（本目录）
```

### 文档规范

- 使用 root-relative 链接：`[Config](/configuration)`
- 标题避免使用 em dash 和 apostrophe
- 代码块使用正确的语言标识

## 相关文档

- [源码启动指南](/dev/getting-started)
- [配置示例大全](/dev/configuration-examples)
- [项目结构](/concepts/architecture)
- [测试指南](/testing)