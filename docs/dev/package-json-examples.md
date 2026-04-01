# OpenClaw package.json 配置详解

本文档以 `/projects/openclaw/package.json` 为例，详细说明各配置项的作用和用法。

---

## 1. 基本信息

```json
{
  "name": "openclaw",
  "version": "2026.3.26",
  "description": "Multi-channel AI gateway with extensible messaging integrations",
  "license": "MIT",
  "type": "module"
}
```

| 字段 | 说明 |
|------|------|
| `name` | 包名称，用于 npm 发布和引用 |
| `version` | 版本号，OpenClaw 使用日历版本格式 `YYYY.M.D` |
| `description` | 包描述，用于 npm 搜索和文档 |
| `license` | 许可证类型 |
| `type` | 模块类型，`module` 表示 ESM |

---

## 2. 入口配置

### 2.1 主入口

```json
{
  "main": "dist/index.js",
  "bin": {
    "openclaw": "openclaw.mjs"
  }
}
```

| 字段 | 说明 |
|------|------|
| `main` | 默认入口，`require("openclaw")` 或 `import openclaw` 时加载 |
| `bin` | CLI 命令映射，安装后可通过 `openclaw` 命令执行 |

### 2.2 导出配置 (exports)

`exports` 定义了包的公开 API 路径，支持子路径导出：

```json
{
  "exports": {
    ".": "./dist/index.js",
    "./plugin-sdk": {
      "types": "./dist/plugin-sdk/index.d.ts",
      "default": "./dist/plugin-sdk/index.js"
    },
    "./plugin-sdk/core": {
      "types": "./dist/plugin-sdk/core.d.ts",
      "default": "./dist/plugin-sdk/core.js"
    },
    "./plugin-sdk/meichao-ecom": {
      "types": "./dist/plugin-sdk/meichao-ecom.d.ts",
      "default": "./dist/plugin-sdk/meichao-ecom.js"
    }
  }
}
```

**使用方式：**

```typescript
// 导入主入口
import { something } from "openclaw";

// 导入 Plugin SDK
import { OpenClawPluginApi } from "openclaw/plugin-sdk";

// 导入特定子路径
import { ProductData } from "openclaw/plugin-sdk/meichao-ecom";
```

**关键点：**

- 每个 `exports` 条目可以单独定义 `types`（TypeScript 类型）和 `default`（运行时代码）
- 子路径必须与实际文件路径对应
- 未在 `exports` 中定义的路径无法被外部导入

---

## 3. 发布文件配置 (files)

```json
{
  "files": [
    "CHANGELOG.md",
    "LICENSE",
    "openclaw.mjs",
    "README.md",
    "assets/",
    "dist/",
    "docs/",
    "!docs/.generated/**",
    "!docs/.i18n/zh-CN.tm.jsonl",
    "skills/"
  ]
}
```

| 模式 | 说明 |
|------|------|
| `"dist/"` | 包含整个 dist 目录 |
| `"!docs/.generated/**"` | 排除 docs/.generated 下的所有文件 |
| `"skills/"` | 包含 skills 目录 |

**注意：** `!` 开头的模式表示排除，用于避免发布内部生成的文件。

---

## 4. 依赖配置

### 4.1 运行时依赖 (dependencies)

```json
{
  "dependencies": {
    "@sinclair/typebox": "0.34.48",
    "@modelcontextprotocol/sdk": "1.28.0",
    "express": "^5.2.1",
    "zod": "^4.3.6"
  }
}
```

**版本格式：**

| 格式 | 示例 | 说明 |
|------|------|------|
| 精确版本 | `"0.34.48"` | 固定版本，不允许更新 |
| 兼容版本 | `"^4.3.6"` | 允许同主版本的更新（4.x.x） |
| 范围版本 | `"^5.2.1"` | 允许 >=5.2.1 且 <6.0.0 |

### 4.2 开发依赖 (devDependencies)

```json
{
  "devDependencies": {
    "@types/node": "^25.5.0",
    "typescript": "^6.0.2",
    "vitest": "^4.1.2",
    "oxlint": "^1.57.0"
  }
}
```

仅开发环境需要的包，不会打包到最终发布版本。

### 4.3 Peer 依赖 (peerDependencies)

```json
{
  "peerDependencies": {
    "@napi-rs/canvas": "^0.1.89",
    "node-llama-cpp": "3.18.1"
  },
  "peerDependenciesMeta": {
    "node-llama-cpp": {
      "optional": true
    }
  }
}
```

**Peer 依赖特点：**

- 由使用者安装，而非包本身
- 用于插件系统，确保版本兼容
- `peerDependenciesMeta.optional: true` 表示可选

---

## 5. 脚本配置 (scripts)

### 5.1 常用脚本

```json
{
  "scripts": {
    "build": "pnpm canvas:a2ui:bundle && node scripts/tsdown-build.mjs && ...",
    "test": "node scripts/test-parallel.mjs",
    "lint": "oxlint --type-aware",
    "format": "oxfmt --write",
    "check": "pnpm check:no-conflict-markers && pnpm tsgo && pnpm lint && ..."
  }
}
```

**命名约定：**

| 前缀 | 用途 |
|------|------|
| `build:` | 构建相关 |
| `test:` | 测试相关 |
| `lint:` | Lint 检查 |
| `format:` | 格式化 |
| `check:` | 验证检查 |

### 5.2 组合脚本

```json
{
  "scripts": {
    "check": "pnpm check:no-conflict-markers && pnpm tsgo && pnpm lint",
    "test:all": "pnpm lint && pnpm build && pnpm test && pnpm test:e2e"
  }
}
```

使用 `&&` 链式调用，前一个命令失败则停止。

---

## 6. pnpm 特定配置

### 6.1 包管理器锁定

```json
{
  "packageManager": "pnpm@10.32.1",
  "engines": {
    "node": ">=22.14.0"
  }
}
```

- `packageManager`：强制使用指定版本的 pnpm（Corepack 支持）
- `engines`：定义 Node.js 最低版本要求

### 6.2 Overrides（依赖覆盖）

```json
{
  "pnpm": {
    "overrides": {
      "hono": "4.12.9",
      "@sinclair/typebox": "0.34.48",
      "tar": "7.5.13"
    }
  }
}
```

强制所有依赖使用指定版本，解决版本冲突或安全问题。

### 6.3 onlyBuiltDependencies（仅构建依赖）

```json
{
  "pnpm": {
    "onlyBuiltDependencies": [
      "@lydell/node-pty",
      "@napi-rs/canvas",
      "sharp"
    ]
  }
}
```

仅对这些包执行 postinstall 构建，避免不必要的编译。

### 6.4 packageExtensions（包扩展）

```json
{
  "pnpm": {
    "packageExtensions": {
      "@mariozechner/pi-coding-agent": {
        "dependencies": {
          "strip-ansi": "^7.2.0"
        }
      }
    }
  }
}
```

为依赖包添加缺失的依赖，解决 peer dependency 问题。

---

## 7. 仓库配置

```json
{
  "repository": {
    "type": "git",
    "url": "git+https://github.com/openclaw/openclaw.git"
  },
  "homepage": "https://github.com/openclaw/openclaw#readme",
  "bugs": {
    "url": "https://github.com/openclaw/openclaw/issues"
  }
}
```

用于 npm 包页面显示源码链接和问题跟踪。

---

## 8. 目录配置

```json
{
  "directories": {
    "doc": "docs",
    "test": "test"
  }
}
```

定义文档和测试目录位置（传统配置，现代项目较少使用）。

---

## 对比：Extension package.json

以 `extensions/meichao-ecom/package.json` 为例，extension 的配置更简洁：

```json
{
  "name": "@openclaw/meichao-ecom",
  "version": "2026.3.25",
  "private": true,
  "type": "module",
  "dependencies": {
    "@sinclair/typebox": "0.34.48",
    "pg": "^8.13.0",
    "redis": "^4.7.0"
  },
  "devDependencies": {
    "vitest": "^1.0.0"
  },
  "openclaw": {
    "extensions": ["./index.ts"],
    "commands": ["meichao"]
  }
}
```

**关键区别：**

| 配置项 | Root package.json | Extension package.json |
|--------|-------------------|------------------------|
| `private` | 无（公开发布） | `true`（不发布） |
| `exports` | 大量子路径导出 | 无（由 root 管理） |
| `bin` | 定义 CLI 命令 | 无 |
| `openclaw` | 无 | 定义 extension 入口和命令 |

---

## 最佳实践

1. **版本锁定**：关键依赖使用精确版本（如 `@sinclair/typebox: "0.34.48"`）
2. **子路径导出**：使用 `exports` 定义清晰的 API 边界
3. **排除生成文件**：在 `files` 中排除 `.generated/` 等目录
4. **脚本命名**：使用 `:` 分隔命名空间，便于理解和管理
5. **pnpm overrides**：解决依赖版本冲突和安全问题
6. **engines + packageManager**：锁定运行环境版本

---

## 相关文件

- `/projects/openclaw/package.json` - 根配置
- `/projects/openclaw/extensions/*/package.json` - 插件配置
- `/projects/openclaw/pnpm-workspace.yaml` - 工作区定义
- `/projects/openclaw/pnpm-lock.yaml` - 锁定文件