# OpenClaw 沙箱实现原理与工程路径分析

## 概述

OpenClaw 的沙箱系统是一个基于 Docker 容器的工具执行隔离环境，旨在限制 Agent 执行工具时的爆炸半径（blast radius）。当模型做出"愚蠢"的操作时，沙箱能够限制文件系统和进程访问范围，提供额外的安全层。

**核心设计原则**：
- 沙箱是可选功能，默认关闭
- Gateway 进程始终运行在宿主机
- 只有工具执行在沙箱内进行
- 提供灵活的配置模式适应不同场景

## 一、架构设计

### 1.1 系统分层

```
┌─────────────────────────────────────────────────────────────┐
│                        Gateway (Host)                        │
│  ┌───────────────────────────────────────────────────────┐ │
│  │                    Agent Runner                        │ │
│  │  ┌─────────────────────────────────────────────────┐ │ │
│  │  │              Sandbox Context                     │ │ │
│  │  │  ┌───────────────────────────────────────────┐ │ │ │
│  │  │  │           Docker Container                 │ │ │ │
│  │  │  │  ┌─────────────────────────────────────┐  │ │ │ │
│  │  │  │  │          Tool Execution              │  │ │ │ │
│  │  │  │  │   (read, write, exec, browser...)    │  │ │ │ │
│  │  │  │  └─────────────────────────────────────┘  │ │ │ │
│  │  │  └───────────────────────────────────────────┘ │ │ │
│  │  └─────────────────────────────────────────────────┘ │ │
│  └───────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### 1.2 核心模块

| 模块 | 职责 | 关键文件 |
|------|------|----------|
| **配置解析** | 合并全局与 Agent 特定的沙箱配置 | `config.ts` |
| **上下文管理** | 解析沙箱运行时状态，准备工作环境 | `context.ts` |
| **容器管理** | Docker 容器生命周期管理 | `docker.ts`, `manage.ts` |
| **浏览器沙箱** | 隔离的浏览器环境（Chromium） | `browser.ts` |
| **工具策略** | 沙箱内工具允许/拒绝列表 | `tool-policy.ts` |
| **工作空间** | 沙箱文件系统隔离与同步 | `workspace.ts` |
| **注册表** | 容器元数据持久化 | `registry.ts` |
| **自动清理** | 闲置容器清理策略 | `prune.ts` |

## 二、配置系统

### 2.1 配置层次结构

沙箱配置支持三层覆盖机制：

```
defaults (全局默认值)
    ↓
agents.defaults.sandbox (全局沙箱配置)
    ↓
agents.list[].sandbox (Agent 特定配置)
```

**代码实现**（`src/agents/sandbox/config.ts:126-172`）：

```typescript
export function resolveSandboxConfigForAgent(
  cfg?: OpenClawConfig,
  agentId?: string,
): SandboxConfig {
  const agent = cfg?.agents?.defaults?.sandbox;
  
  // Agent-specific sandbox config overrides global
  let agentSandbox: typeof agent | undefined;
  const agentConfig = cfg && agentId ? resolveAgentConfig(cfg, agentId) : undefined;
  if (agentConfig?.sandbox) {
    agentSandbox = agentConfig.sandbox;
  }

  const scope = resolveSandboxScope({
    scope: agentSandbox?.scope ?? agent?.scope,
    perSession: agentSandbox?.perSession ?? agent?.perSession,
  });
  
  // ... 配置合并逻辑
}
```

### 2.2 配置类型定义

**核心配置类型**（`src/agents/sandbox/types.ts:51-60`）：

```typescript
export type SandboxConfig = {
  mode: "off" | "non-main" | "all";           // 沙箱启用模式
  scope: SandboxScope;                         // 容器共享范围
  workspaceAccess: SandboxWorkspaceAccess;     // 工作空间访问权限
  workspaceRoot: string;                       // 沙箱工作空间根目录
  docker: SandboxDockerConfig;                 // Docker 容器配置
  browser: SandboxBrowserConfig;               // 浏览器沙箱配置
  tools: SandboxToolPolicy;                    // 工具策略
  prune: SandboxPruneConfig;                   // 自动清理配置
};
```

### 2.3 模式（Mode）

控制**何时**启用沙箱：

| 模式 | 说明 | 适用场景 |
|------|------|----------|
| `off` | 禁用沙箱，所有工具在宿主机执行 | 本地开发、信任环境 |
| `non-main` | 仅对非主会话启用沙箱（默认） | 群组/频道会话隔离 |
| `all` | 所有会话都使用沙箱 | 高安全要求环境 |

**运行时状态解析**（`src/agents/sandbox/runtime-status.ts`）：

```typescript
export function resolveSandboxRuntimeStatus(params: {
  cfg?: OpenClawConfig;
  sessionKey: string;
}): SandboxRuntimeStatus {
  const mode = cfg?.agents?.defaults?.sandbox?.mode ?? "off";
  
  if (mode === "off") {
    return { sandboxed: false, mode };
  }
  
  if (mode === "all") {
    return { sandboxed: true, mode };
  }
  
  // mode === "non-main"
  const mainKey = cfg?.defaults?.session?.mainKey ?? "main";
  const isMain = sessionKey === mainKey;
  return { sandboxed: !isMain, mode };
}
```

### 2.4 作用域（Scope）

控制**容器共享策略**：

| 作用域 | 容器分配策略 | 资源开销 | 隔离性 |
|--------|--------------|----------|--------|
| `session` | 每个会话独立容器 | 高 | 最高 |
| `agent` | 每个 Agent 共享容器 | 中 | 中 |
| `shared` | 所有会话共享一个容器 | 低 | 低 |

**作用域键生成**（`src/agents/sandbox/shared.ts`）：

```typescript
export function resolveSandboxScopeKey(
  scope: SandboxScope,
  sessionKey: string,
): string {
  if (scope === "shared") {
    return "shared";
  }
  if (scope === "agent") {
    return resolveSandboxAgentId(sessionKey) ?? sessionKey;
  }
  return sessionKey; // scope === "session"
}
```

### 2.5 工作空间访问控制

```typescript
export type SandboxWorkspaceAccess = "none" | "ro" | "rw";
```

| 访问级别 | 行为 | 安全级别 |
|----------|------|----------|
| `none` | 使用隔离的沙箱工作空间（`~/.openclaw/sandboxes`） | 最高 |
| `ro` | 挂载 Agent 工作空间为只读（`/agent`） | 中 |
| `rw` | 挂载 Agent 工作空间为读写（`/workspace`） | 低 |

**工作空间初始化**（`src/agents/sandbox/context.ts:44-67`）：

```typescript
const scopeKey = resolveSandboxScopeKey(cfg.scope, rawSessionKey);
const sandboxWorkspaceDir =
  cfg.scope === "shared" ? workspaceRoot : resolveSandboxWorkspaceDir(workspaceRoot, scopeKey);
const workspaceDir = cfg.workspaceAccess === "rw" ? agentWorkspaceDir : sandboxWorkspaceDir;

if (workspaceDir === sandboxWorkspaceDir) {
  await ensureSandboxWorkspace(sandboxWorkspaceDir, agentWorkspaceDir, skipBootstrap);
  if (cfg.workspaceAccess !== "rw") {
    await syncSkillsToWorkspace({ sourceWorkspaceDir, targetWorkspaceDir, config });
  }
}
```

## 三、容器生命周期管理

### 3.1 容器创建流程

```
resolveSandboxContext
    ↓
ensureSandboxContainer
    ↓
createSandboxContainer
    ↓
buildSandboxCreateArgs → execDocker(create) → execDocker(start)
```

**容器创建参数构建**（`src/agents/sandbox/docker.ts:125-206`）：

```typescript
export function buildSandboxCreateArgs(params: {
  name: string;
  cfg: SandboxDockerConfig;
  scopeKey: string;
  createdAtMs?: number;
  labels?: Record<string, string>;
  configHash?: string;
}) {
  const args = ["create", "--name", params.name];
  
  // OpenClaw 标签
  args.push("--label", "openclaw.sandbox=1");
  args.push("--label", `openclaw.sessionKey=${params.scopeKey}`);
  args.push("--label", `openclaw.createdAtMs=${createdAtMs}`);
  
  // 安全配置
  if (params.cfg.readOnlyRoot) args.push("--read-only");
  args.push("--security-opt", "no-new-privileges");
  for (const cap of params.cfg.capDrop) args.push("--cap-drop", cap);
  
  // 资源限制
  if (params.cfg.memory) args.push("--memory", params.cfg.memory);
  if (params.cfg.cpus) args.push("--cpus", String(params.cfg.cpus));
  if (params.cfg.pidsLimit) args.push("--pids-limit", String(params.cfg.pidsLimit));
  
  // 卷挂载
  for (const entry of params.cfg.tmpfs) args.push("--tmpfs", entry);
  for (const bind of params.cfg.binds ?? []) args.push("-v", bind);
  
  return args;
}
```

### 3.2 配置变更检测

沙箱系统实现了热容器的智能管理：

1. **配置哈希计算**：基于 Docker 配置、工作空间访问权限、路径计算哈希
2. **热容器保护**：最近使用（5分钟内）的热容器不会被强制重建
3. **优雅重建**：冷容器自动删除并按新配置重建

**代码实现**（`src/agents/sandbox/docker.ts:276-351`）：

```typescript
const HOT_CONTAINER_WINDOW_MS = 5 * 60 * 1000;

export async function ensureSandboxContainer(params: {
  sessionKey: string;
  workspaceDir: string;
  agentWorkspaceDir: string;
  cfg: SandboxConfig;
}) {
  const expectedHash = computeSandboxConfigHash({ /* ... */ });
  const state = await dockerContainerState(containerName);
  
  if (hasContainer) {
    currentHash = await readContainerConfigHash(containerName);
    hashMismatch = !currentHash || currentHash !== expectedHash;
    
    if (hashMismatch) {
      const isHot = running && (now - lastUsedAtMs < HOT_CONTAINER_WINDOW_MS);
      if (isHot) {
        // 记录警告，提示用户手动重建
        defaultRuntime.log(`Sandbox config changed... Recreate to apply: ${hint}`);
      } else {
        // 冷容器：自动重建
        await execDocker(["rm", "-f", containerName], { allowFailure: true });
      }
    }
  }
  
  if (!hasContainer) {
    await createSandboxContainer({ /* ... */ });
  }
}
```

### 3.3 注册表机制

容器元数据持久化到 JSON 文件（`~/.openclaw/sandbox-registry.json`）：

```typescript
type SandboxRegistryEntry = {
  containerName: string;
  sessionKey: string;
  createdAtMs: number;
  lastUsedAtMs: number;
  image: string;
  configHash?: string;
};
```

注册表用于：
- 容器列表展示（`openclaw sandbox list`）
- 闲置时间追踪（自动清理）
- 配置哈希关联

## 四、安全机制

### 4.1 Docker 安全选项

默认安全配置（`src/agents/sandbox/constants.ts`）：

```typescript
export const DEFAULT_SANDBOX_IMAGE = "openclaw-sandbox:bookworm-slim";
export const DEFAULT_SANDBOX_CONTAINER_PREFIX = "openclaw-sandbox-";
export const DEFAULT_SANDBOX_WORKDIR = "/workspace";

// 安全默认值
readOnlyRoot: true,           // 只读根文件系统
tmpfs: ["/tmp", "/var/tmp", "/run"],  // 临时文件系统
network: "none",              // 默认无网络
capDrop: ["ALL"],             // 丢弃所有特权
```

**安全选项映射**：

| 配置项 | Docker 参数 | 安全效果 |
|--------|-------------|----------|
| `readOnlyRoot` | `--read-only` | 根文件系统只读 |
| `capDrop` | `--cap-drop ALL` | 丢弃所有 Linux 特权 |
| `no-new-privileges` | `--security-opt no-new-privileges` | 禁止提升特权 |
| `seccompProfile` | `--security-opt seccomp=...` | 系统调用过滤 |
| `apparmorProfile` | `--security-opt apparmor=...` | AppArmor 强制访问控制 |
| `user` | `--user` | 非 root 用户运行 |

### 4.2 工具策略

沙箱内的工具执行受允许/拒绝列表控制：

```typescript
export type SandboxToolPolicy = {
  allow?: string[];  // 允许的工具模式（支持通配符）
  deny?: string[];   // 拒绝的工具模式
};
```

**模式匹配实现**（`src/agents/sandbox/tool-policy.ts:16-56`）：

```typescript
function compilePattern(pattern: string): CompiledPattern {
  const normalized = pattern.trim().toLowerCase();
  if (normalized === "*") {
    return { kind: "all" };
  }
  if (!normalized.includes("*")) {
    return { kind: "exact", value: normalized };
  }
  // 通配符转换为正则
  const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return {
    kind: "regex",
    value: new RegExp(`^${escaped.replaceAll("\\*", ".*")}$`),
  };
}
```

**决策逻辑**：
1. 先检查 deny 列表，匹配则拒绝
2. allow 列表为空则允许所有
3. allow 列表非空则必须匹配才允许

### 4.3 路径安全

防止路径遍历攻击（`src/agents/sandbox-paths.ts`）：

```typescript
export function resolveSandboxPath(
  requestedPath: string,
  containerWorkdir: string,
): { safePath: string; workdirRelative: string } {
  // 规范化路径，解析 .. 和 .
  const normalized = path.normalize(requestedPath);
  
  // 确保路径在工作目录内
  const safePath = path.join(containerWorkdir, normalized);
  if (!safePath.startsWith(containerWorkdir)) {
    throw new Error("Path escapes container workdir");
  }
  
  return { safePath, workdirRelative: normalized };
}
```

## 五、浏览器沙箱

### 5.1 架构

浏览器沙箱是独立的 Docker 容器，包含：
- Chromium 浏览器（带 CDP 支持）
- VNC 服务器（用于远程查看）
- noVNC（浏览器内 VNC 客户端）

```
┌─────────────────────────────────────────┐
│       Browser Sandbox Container         │
│  ┌─────────────────────────────────┐   │
│  │        Chromium Browser          │   │
│  │     (CDP on port 9222)          │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │        VNC Server               │   │
│  │     (port 5900)                 │   │
│  └─────────────────────────────────┘   │
│  ┌─────────────────────────────────┐   │
│  │        noVNC Web Server         │   │
│  │     (port 6080)                 │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### 5.2 端口映射

浏览器容器使用动态端口映射：

```typescript
// 容器内固定端口
const CDP_PORT = 9222;
const VNC_PORT = 5900;
const NOVNC_PORT = 6080;

// 宿主机动态分配
args.push("-p", `127.0.0.1::${cdpPort}`);   // 随机宿主机端口
args.push("-p", `127.0.0.1::${noVncPort}`); // 随机宿主机端口
```

**端口读取**（`src/agents/sandbox/docker.ts:36-50`）：

```typescript
export async function readDockerPort(containerName: string, port: number) {
  const result = await execDocker(
    ["port", containerName, `${port}/tcp`], 
    { allowFailure: true }
  );
  const line = result.stdout.trim().split(/\r?\n/)[0] ?? "";
  const match = line.match(/:(\d+)\s*$/);
  return Number.parseInt(match[1] ?? "", 10);
}
```

### 5.3 桥接服务器

通过桥接服务器将 CDP 协议暴露给 Gateway：

```typescript
const bridge = await startBrowserBridgeServer({
  resolved: {
    cdpProtocol: "http",
    cdpHost: "127.0.0.1",
    cdpPort: mappedCdpPort,  // 动态映射的端口
    headless: false,
    // ...
  },
});
```

桥接服务器提供：
- CDP 协议转发
- 浏览器自动化控制
- 页面执行 JavaScript 能力

## 六、工作空间管理

### 6.1 工作空间类型

| 工作空间 | 路径 | 用途 |
|----------|------|------|
| Agent 工作空间 | `~/.openclaw/workspace` | 宿主机上的持久化工作区 |
| 沙箱工作空间 | `~/.openclaw/sandboxes/{scopeKey}/` | 隔离的临时工作区 |
| Agent 工作空间挂载 | `/agent` | 只读挂载点（ro 模式） |
| 主工作目录 | `/workspace` | 沙箱内默认工作目录 |

### 6.2 技能同步

当 `workspaceAccess` 不为 `rw` 时，符合条件的技能文件会被镜像到沙箱工作空间：

```typescript
await syncSkillsToWorkspace({
  sourceWorkspaceDir: agentWorkspaceDir,
  targetWorkspaceDir: sandboxWorkspaceDir,
  config,
});
```

同步策略：
- 只同步可读文件（符合 `read` 工具策略）
- 保持目录结构
- 写入 `skills/` 子目录

### 6.3 入站媒体处理

外部媒体（图片、文档等）被暂存到沙箱：

```typescript
// src/auto-reply/reply/stage-sandbox-media.ts
export async function stageInboundMediaToSandbox(params: {
  sandboxWorkspaceDir: string;
  mediaFiles: MediaFile[];
}) {
  const inboundDir = path.join(sandboxWorkspaceDir, "media", "inbound");
  await fs.mkdir(inboundDir, { recursive: true });
  
  for (const file of mediaFiles) {
    const dest = path.join(inboundDir, sanitizeFilename(file.name));
    await fs.copyFile(file.path, dest);
  }
}
```

## 七、容器镜像

### 7.1 基础沙箱镜像

**Dockerfile**（`Dockerfile.sandbox`）：

```dockerfile
FROM debian:bookworm-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    bash \
    ca-certificates \
    curl \
    git \
    jq \
    python3 \
    ripgrep \
  && rm -rf /var/lib/apt/lists/*

CMD ["sleep", "infinity"]
```

包含基础工具：
- `bash`: Shell 执行
- `git`: 版本控制
- `python3`: 脚本执行
- `ripgrep`: 快速搜索
- `jq`: JSON 处理
- `curl`: HTTP 请求

**注意**：默认镜像不包含 Node.js，需要 Node 的技能可以通过自定义镜像或 `setupCommand` 安装。

### 7.2 浏览器沙箱镜像

浏览器镜像基于 `jlesage/baseimage-gui` 并包含：
- Chromium 浏览器
- ChromeDriver
- VNC 服务器 (TigerVNC)
- noVNC Web 客户端
- Fluxbox 窗口管理器

### 7.3 镜像构建脚本

**基础镜像**（`scripts/sandbox-setup.sh`）：

```bash
#!/bin/bash
set -e

cd "$(dirname "$0")/.."

docker build -f Dockerfile.sandbox -t openclaw-sandbox:bookworm-slim .
echo "Sandbox image built: openclaw-sandbox:bookworm-slim"
```

**浏览器镜像**（`scripts/sandbox-browser-setup.sh`）：

```bash
#!/bin/bash
set -e

cd "$(dirname "$0")/.."

docker build -f Dockerfile.sandbox-browser -t openclaw-sandbox-browser:latest .
echo "Browser sandbox image built: openclaw-sandbox-browser:latest"
```

## 八、CLI 管理

### 8.1 沙箱命令

```bash
# 列出所有沙箱容器
openclaw sandbox list

# 解释当前沙箱配置（调试）
openclaw sandbox explain [--agent <id>] [--session <key>]

# 重建沙箱容器
openclaw sandbox recreate [--agent <id>] [--session <key>] [--all]
```

### 8.2 配置验证

`explain` 命令显示有效配置：

```typescript
// src/commands/sandbox-explain.ts
export async function sandboxExplainCommand(params: {
  agentId?: string;
  sessionKey?: string;
}) {
  const config = loadConfig();
  const resolved = resolveSandboxConfigForAgent(config, params.agentId);
  
  console.log("Effective sandbox configuration:");
  console.log(`  mode: ${resolved.mode}`);
  console.log(`  scope: ${resolved.scope}`);
  console.log(`  workspaceAccess: ${resolved.workspaceAccess}`);
  console.log(`  docker.image: ${resolved.docker.image}`);
  // ...
}
```

## 九、自动清理

### 9.1 清理策略

```typescript
export type SandboxPruneConfig = {
  idleHours: number;   // 闲置时间阈值
  maxAgeDays: number;  // 最大存活时间
};
```

默认配置：
- `idleHours: 24` - 24小时未使用
- `maxAgeDays: 7` - 最长存活7天

### 9.2 清理逻辑

**代码实现**（`src/agents/sandbox/prune.ts`）：

```typescript
export async function maybePruneSandboxes(cfg: SandboxConfig) {
  const registry = await readRegistry();
  const now = Date.now();
  
  for (const entry of registry.entries) {
    const idleMs = now - entry.lastUsedAtMs;
    const ageMs = now - entry.createdAtMs;
    
    const shouldPrune = 
      idleMs > cfg.prune.idleHours * 60 * 60 * 1000 ||
      ageMs > cfg.prune.maxAgeDays * 24 * 60 * 60 * 1000;
    
    if (shouldPrune) {
      await execDocker(["rm", "-f", entry.containerName], { allowFailure: true });
      await removeRegistryEntry(entry.containerName);
    }
  }
}
```

清理触发时机：
- 每次创建新沙箱上下文时
- 容器启动前检查
- 不影响运行中的会话

## 十、典型配置示例

### 10.1 最小启用配置

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",      // 仅非主会话使用沙箱
        scope: "session",      // 每会话独立容器
        workspaceAccess: "none", // 完全隔离
      },
    },
  },
}
```

### 10.2 开发环境配置

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        scope: "agent",        // Agent 级别共享
        workspaceAccess: "ro", // 只读访问工作空间
        docker: {
          network: "bridge",   // 允许网络访问
          binds: [
            "/var/run/docker.sock:/var/run/docker.sock:ro",
          ],
        },
      },
    },
  },
}
```

### 10.3 高安全配置

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "all",           // 所有会话都沙箱化
        scope: "session",      // 完全隔离
        workspaceAccess: "none",
        docker: {
          network: "none",     // 无网络
          readOnlyRoot: true,
          user: "1000:1000",   // 非 root 用户
          seccompProfile: "/path/to/seccomp.json",
        },
      },
    },
  },
}
```

### 10.4 浏览器沙箱配置

```json5
{
  agents: {
    defaults: {
      sandbox: {
        mode: "non-main",
        browser: {
          enabled: true,
          headless: false,     // 显示浏览器窗口
          enableNoVnc: true,   // 启用 Web VNC
          autoStart: true,     // 自动启动浏览器
          allowHostControl: false, // 不允许控制宿主机浏览器
        },
      },
    },
  },
}
```

## 十一、总结

OpenClaw 的沙箱系统通过 Docker 容器提供了灵活的工具执行隔离机制：

**核心优势**：
1. **渐进式安全**：从完全关闭到完全隔离，可按需配置
2. **灵活的作用域**：平衡资源开销与隔离性
3. **智能生命周期**：热容器保护、自动清理
4. **浏览器隔离**：独立的浏览器环境防止会话交叉
5. **透明配置**：explain 命令让配置行为可观测

**工程实现亮点**：
- 三层配置合并机制（defaults → global → agent）
- 配置哈希驱动的容器重建策略
- 注册表持久化实现容器元数据管理
- 通配符工具策略支持灵活的工具控制
- 动态端口映射解决多容器端口冲突

**使用建议**：
- 本地开发：使用 `mode: "off"` 或 `"non-main"` + `scope: "agent"`
- 生产环境：使用 `"all"` + `scope: "session"` + `workspaceAccess: "none"`
- 浏览器自动化：启用 `sandbox.browser` 实现完全隔离

通过沙箱系统，OpenClaw 在保持易用性的同时，为用户提供了必要的安全边界，有效降低了 Agent 执行工具时的风险暴露面。
