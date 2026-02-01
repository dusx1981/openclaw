# 任务队列架构

任务队列（Task Queue）是 OpenClaw Gateway 的核心组件，负责管理后台任务的调度、执行和监控。它由两个子系统组成：命令队列（Command Queue）用于即时任务序列化，以及 Cron 服务用于定时任务调度。

## 概述

任务队列作为 OpenClaw 后台任务的**调度与执行中心**，承担以下核心职责：

| 职责 | 描述 |
|------|------|
| **任务调度** | 根据时间表（Cron表达式、间隔、固定时间）调度任务 |
| **即时执行** | 支持手动触发立即执行任务 |
| **队列管理** | 管理多车道（lane）任务队列，支持并发控制 |
| **状态跟踪** | 跟踪任务执行状态（待执行/执行中/已完成/失败） |
| **持久化存储** | 将任务配置和状态持久化到磁盘 |
| **定时器管理** | 维护高效的下一次执行定时器 |
| **隔离执行** | 支持在主会话或隔离会话中执行任务 |
| **结果交付** | 将任务结果投递到指定通道或用户 |
| **失败重试** | 处理任务失败并提供错误信息 |
| **并发控制** | 防止同一任务重复执行，控制并发数 |

## 架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                        任务来源层                                   │
├─────────────────┬─────────────────┬─────────────────────────────────┤
│   定时调度      │   手动触发      │   系统事件                      │
│                 │                 │                                 │
│ • Cron 表达式   │ • CLI 命令      │ • 启动后初始化                  │
│ • 固定间隔      │ • Web UI        │ • 配置重载                      │
│ • 一次性任务    │ • API 调用      │ • 心跳触发                      │
└────────┬────────┴────────┬────────┴────────┬────────────────────────┘
         │                 │                 │
         └─────────────────┴─────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      任务队列核心                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  ┌──────────────────────────┐  ┌──────────────────────────────┐    │
│  │      命令队列            │  │        Cron 服务             │    │
│  │  (command-queue.ts)      │  │    (cron/service.ts)         │    │
│  │                          │  │                              │    │
│  │  多车道队列系统：        │  │  定时任务调度器：            │    │
│  │  • main (默认)           │  │  • 定时器管理                │    │
│  │  • cron (定时任务)       │  │  • 时间表计算                │    │
│  │  • 自定义车道            │  │  • 任务持久化                │    │
│  │                          │  │  • 状态跟踪                  │    │
│  └──────────┬───────────────┘  └──────────────┬────────────────┘    │
│             │                                 │                     │
│             │                                 │                     │
│             ▼                                 ▼                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   任务执行引擎                              │   │
│  │                                                             │   │
│  │  ┌─────────────────┐    ┌─────────────────────────────┐    │   │
│  │  │   主会话执行    │    │      隔离执行               │    │   │
│  │  │                 │    │                             │    │   │
│  │  │ • 系统事件投递  │    │ • 独立智能体会话            │    │   │
│  │  │ • 心跳唤醒      │    │ • 结果回传主会话            │    │   │
│  │  │ • 状态共享      │    │ • 并发执行                  │    │   │
│  │  └─────────────────┘    └─────────────────────────────┘    │   │
│  │                                                             │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                           │                                         │
│                           ▼                                         │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │                   结果交付层                                │   │
│  │                                                             │   │
│  │  • 消息通道 (WhatsApp/Telegram/Discord等)                   │   │
│  │  • 系统日志                                                 │   │
│  │  • 运行日志 (run-log)                                       │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. 命令队列 (`command-queue.ts`)

命令队列是一个轻量级的进程内队列系统，用于序列化命令执行：

```typescript
// 队列项结构
interface QueueEntry {
  task: () => Promise<unknown>;           // 任务函数
  resolve: (value: unknown) => void;      // 成功回调
  reject: (reason?: unknown) => void;     // 失败回调
  enqueuedAt: number;                     // 入队时间
  warnAfterMs: number;                    // 警告阈值
  onWait?: (waitMs: number, queuedAhead: number) => void;  // 等待回调
}

// 车道状态
interface LaneState {
  lane: string;                           // 车道名称
  queue: QueueEntry[];                    // 等待队列
  active: number;                         // 当前执行任务数
  maxConcurrent: number;                  // 最大并发数
  draining: boolean;                      // 是否正在排空
}

// 核心函数
function enqueueCommand<T>(
  task: () => Promise<T>,
  opts?: { warnAfterMs?: number; onWait?: Function }
): Promise<T>

function enqueueCommandInLane<T>(
  lane: string,
  task: () => Promise<T>,
  opts?: { warnAfterMs?: number; onWait?: Function }
): Promise<T>

function setCommandLaneConcurrency(lane: string, maxConcurrent: number): void
function getQueueSize(lane?: string): number
function clearCommandLane(lane?: string): number
```

**车道（Lane）设计：**

| 车道 | 用途 | 并发数 |
|------|------|--------|
| `main` | 主要自动回复工作流 | 1（默认） |
| `cron` | 定时任务执行 | 可配置 |
| `auth-probe:*` | 认证探测 | 1 |
| `session:probe-*` | 会话探测 | 1 |
| 自定义 | 用户定义车道 | 可配置 |

### 2. Cron 服务 (`cron/service.ts`)

Cron 服务是一个完整的定时任务调度系统：

```typescript
class CronService {
  // 生命周期
  async start(): Promise<void>    // 启动服务，加载任务，启动定时器
  stop(): void                    // 停止服务，清理定时器
  
  // 任务管理
  async list(opts?: { includeDisabled?: boolean }): Promise<CronJob[]>  // 列出任务
  async add(input: CronJobCreate): Promise<CronJob>                    // 添加任务
  async update(id: string, patch: CronJobPatch): Promise<CronJob>      // 更新任务
  async remove(id: string): Promise<{ ok: boolean; removed: boolean }> // 删除任务
  async run(id: string, mode?: "due" | "force"): Promise<{ ok: boolean; ran: boolean }>  // 立即执行
  
  // 唤醒
  wake(opts: { mode: "now" | "next-heartbeat"; text: string }): { ok: boolean }
  
  // 状态
  async status(): Promise<CronServiceStatus>
}
```

### 3. 任务结构 (`cron/types.ts`)

```typescript
// Cron 任务
interface CronJob {
  id: string;                    // 唯一标识
  agentId?: string;              // 关联的智能体
  name: string;                  // 任务名称
  description?: string;          // 描述
  enabled: boolean;              // 是否启用
  deleteAfterRun?: boolean;      // 执行后是否删除（一次性任务）
  createdAtMs: number;           // 创建时间
  updatedAtMs: number;           // 更新时间
  
  // 调度配置
  schedule: CronSchedule;        // 调度规则
  sessionTarget: "main" | "isolated";  // 执行目标会话
  wakeMode: "next-heartbeat" | "now";  // 唤醒模式
  
  // 执行内容
  payload: CronPayload;          // 任务载荷
  isolation?: CronIsolation;     // 隔离配置
  
  // 运行时状态
  state: CronJobState;
}

// 调度规则类型
interface CronSchedule {
  // 三种调度方式：
  | { kind: "at"; atMs: number }                           // 固定时间点
  | { kind: "every"; everyMs: number; anchorMs?: number }  // 固定间隔
  | { kind: "cron"; expr: string; tz?: string }            // Cron 表达式
}

// 任务载荷类型
interface CronPayload {
  | { kind: "systemEvent"; text: string }                  // 系统事件
  | {                                                    // 智能体轮次
      kind: "agentTurn";
      message: string;
      model?: string;           // 模型覆盖
      thinking?: string;        // 思考级别
      timeoutSeconds?: number;  // 超时时间
      deliver?: boolean;        // 是否投递结果
      channel?: CronMessageChannel;  // 目标通道
      to?: string;              // 目标用户
      bestEffortDeliver?: boolean;   // 尽力投递
    }
}

// 运行时状态
interface CronJobState {
  nextRunAtMs?: number;          // 下次执行时间
  runningAtMs?: number;          // 当前开始时间（执行中）
  lastRunAtMs?: number;          // 上次执行时间
  lastStatus?: "ok" | "error" | "skipped";  // 上次状态
  lastError?: string;            // 上次错误信息
  lastDurationMs?: number;       // 上次执行时长
}
```

## 调度机制

### 1. 定时器管理

```typescript
// 定时器状态
interface CronServiceState {
  timer: ReturnType<typeof setTimeout> | null;  // 当前定时器
  running: boolean;                              // 是否正在执行
  store: CronStoreFile | null;                   // 任务存储
  deps: CronServiceDeps;                         // 依赖注入
}

// 启动定时器
function armTimer(state: CronServiceState) {
  // 1. 清除现有定时器
  if (state.timer) {
    clearTimeout(state.timer);
  }
  
  // 2. 计算下次唤醒时间
  const nextAt = nextWakeAtMs(state);
  if (!nextAt) return;
  
  // 3. 设置新定时器
  const delay = Math.max(nextAt - nowMs(), 0);
  const clampedDelay = Math.min(delay, MAX_TIMEOUT_MS);  // 防止溢出
  
  state.timer = setTimeout(() => {
    void onTimer(state).catch(handleError);
  }, clampedDelay);
}
```

### 2. 执行流程

```
定时器触发
    │
    ▼
┌─────────────────────────────────┐
│ 1. onTimer()                    │
│    • 检查 running 标志防止并发  │
│    • 获取文件锁                 │
│    • 加载任务存储               │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 2. runDueJobs()                 │
│    • 筛选 enabled 任务          │
│    • 筛选非 running 任务        │
│    • 筛选 nextRunAtMs <= now    │
└──────────┬──────────────────────┘
           │
           ▼
┌─────────────────────────────────┐
│ 3. executeJob()                 │
│    • 标记 runningAtMs           │
│    • 根据 sessionTarget 分支：  │
└──────────┬──────────────────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
┌─────────┐  ┌──────────────────┐
│ 主会话  │  │   隔离会话       │
│         │  │                  │
│ • 投递  │  │ • 创建独立会话   │
│   系统  │  │ • 执行智能体轮次 │
│   事件  │  │ • 处理结果       │
│ • 唤醒  │  │ • 回传主会话     │
│   心跳  │  │                  │
└────┬────┘  └────────┬─────────┘
     │                │
     └────────┬───────┘
              │
              ▼
┌─────────────────────────────────┐
│ 4. finish()                     │
│    • 更新状态（ok/error/skipped）│
│    • 计算下次执行时间            │
│    • 一次性任务处理              │
│    • 持久化存储                  │
│    • 发送事件                    │
└──────────┬──────────────────────┘
           │
           ▼
    重新启动定时器
```

### 3. 时间表计算

```typescript
// 计算下次执行时间
function computeJobNextRunAtMs(job: CronJob, nowMs: number): number | undefined {
  switch (job.schedule.kind) {
    case "at":
      // 一次性任务：返回固定时间（如果已过则不返回）
      return job.schedule.atMs > nowMs ? job.schedule.atMs : undefined;
      
    case "every":
      // 固定间隔：基于 anchor 或上次执行时间
      const anchor = job.schedule.anchorMs ?? job.createdAtMs;
      const every = job.schedule.everyMs;
      const elapsed = nowMs - anchor;
      const cycles = Math.floor(elapsed / every) + 1;
      return anchor + cycles * every;
      
    case "cron":
      // Cron 表达式：使用 cron-parser 解析
      const interval = parseExpression(job.schedule.expr, {
        tz: job.schedule.tz,
        currentDate: new Date(nowMs),
      });
      return interval.next().getTime();
  }
}

// 找出下次唤醒时间（所有任务中最小的 nextRunAtMs）
function nextWakeAtMs(state: CronServiceState): number | undefined {
  const jobs = state.store?.jobs ?? [];
  const enabled = jobs.filter(j => j.enabled && !j.state.runningAtMs);
  const nextTimes = enabled
    .map(j => j.state.nextRunAtMs)
    .filter((t): t is number => typeof t === "number");
  return nextTimes.length > 0 ? Math.min(...nextTimes) : undefined;
}
```

## 执行模式

### 1. 主会话执行（Main Session）

```typescript
// 主会话任务执行
async function executeMainJob(state, job) {
  // 1. 解析载荷文本
  const text = resolveJobPayloadTextForMain(job);
  if (!text) {
    return finish("skipped", "requires non-empty text");
  }
  
  // 2. 投递系统事件
  state.deps.enqueueSystemEvent(text, { agentId: job.agentId });
  
  // 3. 根据 wakeMode 处理
  if (job.wakeMode === "now") {
    // 立即唤醒：运行一次心跳
    const result = await runHeartbeatWithRetry(state);
    
    if (result.status === "ran") {
      await finish("ok", undefined, text);
    } else if (result.status === "skipped") {
      await finish("skipped", result.reason, text);
    } else {
      await finish("error", result.reason, text);
    }
  } else {
    // 下次心跳：只请求不等待
    state.deps.requestHeartbeatNow({ reason: `cron:${job.id}` });
    await finish("ok", undefined, text);
  }
}
```

**适用场景：**
- 需要与主工作流共享状态
- 需要访问当前会话上下文
- 轻量级任务（如提醒、通知）

### 2. 隔离执行（Isolated Session）

```typescript
// 隔离任务执行
async function executeIsolatedJob(state, job) {
  // 1. 验证载荷
  if (job.payload.kind !== "agentTurn") {
    return finish("skipped", "requires agentTurn payload");
  }
  
  // 2. 在独立会话中执行
  const result = await state.deps.runIsolatedAgentJob({
    job,
    message: job.payload.message,
  });
  
  // 3. 处理结果
  if (result.status === "ok") {
    await finish("ok", undefined, result.summary, result.outputText);
  } else if (result.status === "skipped") {
    await finish("skipped", undefined, result.summary, result.outputText);
  } else {
    await finish("error", result.error, result.summary, result.outputText);
  }
  
  // 4. 回传结果到主会话（可选）
  const prefix = job.isolation?.postToMainPrefix ?? "Cron";
  const mode = job.isolation?.postToMainMode ?? "summary";
  
  let body = result.summary ?? result.error ?? result.status;
  if (mode === "full" && result.outputText) {
    const maxChars = job.isolation?.postToMainMaxChars ?? 8000;
    body = result.outputText.length > maxChars 
      ? `${result.outputText.slice(0, maxChars)}…` 
      : result.outputText;
  }
  
  state.deps.enqueueSystemEvent(`${prefix}: ${body}`, { agentId: job.agentId });
  
  // 5. 唤醒心跳（如果需要）
  if (job.wakeMode === "now") {
    state.deps.requestHeartbeatNow({ reason: `cron:${job.id}:post` });
  }
}
```

**隔离配置选项：**

```typescript
interface CronIsolation {
  postToMainPrefix?: string;        // 回传消息前缀（默认 "Cron"）
  postToMainMode?: "summary" | "full";  // 回传模式
  postToMainMaxChars?: number;      // 完整模式最大字符数（默认 8000）
}
```

**适用场景：**
- 长时间运行的任务
- 需要独立上下文的任务
- 并发执行不干扰主工作流
- 结果需要投递到外部通道

## 并发控制

### 1. 命令队列并发

```typescript
// 设置车道并发数
setCommandLaneConcurrency("main", 1);        // 主车道：串行
setCommandLaneConcurrency("cron", 3);        // Cron 车道：3 并发
setCommandLaneConcurrency("custom", 5);      // 自定义车道：5 并发

// 队列排空算法
function drainLane(lane: string) {
  const state = getLaneState(lane);
  
  const pump = () => {
    // 当未达到并发上限且队列非空时持续执行
    while (state.active < state.maxConcurrent && state.queue.length > 0) {
      const entry = state.queue.shift();
      state.active += 1;
      
      // 执行任务
      entry.task()
        .then(result => {
          state.active -= 1;
          entry.resolve(result);
          pump();  // 递归调用继续排空
        })
        .catch(err => {
          state.active -= 1;
          entry.reject(err);
          pump();
        });
    }
  };
  
  pump();
}
```

### 2. Cron 任务并发控制

```typescript
// 防止同一任务重复执行
function isJobDue(job, nowMs, opts): boolean {
  // 任务正在执行中
  if (typeof job.state.runningAtMs === "number") {
    return false;
  }
  
  // 任务已禁用
  if (!job.enabled) {
    return false;
  }
  
  // 检查是否到达执行时间
  const next = job.state.nextRunAtMs;
  return typeof next === "number" && nowMs >= next;
}

// 文件锁防止多实例并发
async function locked<T>(state: CronServiceState, fn: () => Promise<T>): Promise<T> {
  await state.deps.lock.acquire();
  try {
    return await fn();
  } finally {
    state.deps.lock.release();
  }
}
```

## 配置示例

### 完整 Cron 配置

```yaml
# config.yml

# 启用 Cron 服务
cron:
  enabled: true
  storePath: "~/.openclaw/cron-jobs.json"  # 任务存储路径

# 定义定时任务
jobs:
  - id: "morning-report"
    name: "晨间报告"
    enabled: true
    schedule:
      kind: "cron"
      expr: "0 8 * * *"           # 每天早上 8 点
      tz: "Asia/Shanghai"         # 时区
    sessionTarget: "isolated"
    wakeMode: "now"
    payload:
      kind: "agentTurn"
      message: "生成今日待办事项和日程安排"
      model: "claude-sonnet-4-20250514"
      thinking: "medium"
      deliver: true
      channel: "telegram"
      to: "my-user-id"
      bestEffortDeliver: true
    isolation:
      postToMainPrefix: "晨间报告"
      postToMainMode: "summary"
      postToMainMaxChars: 2000

  - id: "hourly-check"
    name: "每小时检查"
    enabled: true
    schedule:
      kind: "every"
      everyMs: 3600000             # 每小时
    sessionTarget: "main"
    wakeMode: "next-heartbeat"
    payload:
      kind: "systemEvent"
      text: "执行例行系统检查"

  - id: "one-time-task"
    name: "一次性任务"
    enabled: true
    deleteAfterRun: true           # 执行后删除
    schedule:
      kind: "at"
      atMs: 1704067200000          # 固定时间点
    sessionTarget: "isolated"
    wakeMode: "now"
    payload:
      kind: "agentTurn"
      message: "执行一次性数据处理"
```

### API 使用示例

```typescript
// 添加定时任务
const job = await cronService.add({
  name: "每日备份",
  enabled: true,
  schedule: {
    kind: "cron",
    expr: "0 2 * * *",  // 每天凌晨 2 点
  },
  sessionTarget: "isolated",
  wakeMode: "now",
  payload: {
    kind: "agentTurn",
    message: "执行数据库备份",
    deliver: true,
    channel: "slack",
    to: "#backups",
  },
});

// 立即执行任务
await cronService.run(job.id, "force");

// 更新任务
await cronService.update(job.id, {
  enabled: false,  // 暂停任务
});

// 删除任务
await cronService.remove(job.id);

// 查询状态
const status = await cronService.status();
console.log(status);
// { enabled: true, storePath: "...", jobs: 5, nextWakeAtMs: 1234567890 }
```

## 关键文件

| 文件 | 用途 |
|------|------|
| `src/process/command-queue.ts` | 命令队列实现 |
| `src/cron/service.ts` | Cron 服务主类 |
| `src/cron/types.ts` | Cron 类型定义 |
| `src/cron/service/ops.ts` | Cron 操作实现 |
| `src/cron/service/timer.ts` | 定时器管理和任务执行 |
| `src/cron/service/jobs.ts` | 任务管理工具函数 |
| `src/cron/service/state.ts` | 服务状态管理 |
| `src/cron/service/store.ts` | 持久化存储 |
| `src/cron/service/locked.ts` | 文件锁实现 |
| `src/cron/schedule.ts` | 时间表解析 |
| `src/cron/parse.ts` | Cron 表达式解析 |
| `src/cron/run-log.ts` | 运行日志记录 |
| `src/cron/isolated-agent.ts` | 隔离执行实现 |
| `src/gateway/server-methods/cron.ts` | Gateway Cron API 处理器 |

## 运行时状态

```typescript
interface TaskQueueState {
  // 命令队列状态
  lanes: Map<string, LaneState>;
  
  // Cron 服务状态
  cron: {
    enabled: boolean;
    storePath: string;
    jobs: CronJob[];
    nextWakeAtMs?: number;
    running: boolean;
  };
  
  // 统计信息
  stats: {
    totalExecuted: number;
    totalFailed: number;
    averageExecutionTime: number;
    lastExecutionAt: number;
  };
}
```

## 相关文档

- [Gateway 架构](/code/gateway-architecture)
- [Protocol Handler 架构](/code/protocol-handler-architecture)
- [智能体系统](/agents/overview)
- [配置系统](/configuration)
- [CLI 工具](/cli/cron)