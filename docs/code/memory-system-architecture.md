# 记忆系统架构

OpenClaw 记忆系统是一个基于向量和全文检索的混合搜索系统，为 AI Agent 提供长期记忆能力。它通过索引 Markdown 记忆文件和会话记录，实现语义搜索和关键词检索。

## 概述

记忆系统作为 OpenClaw 的**长期记忆中枢**，具有以下主要职责：

| 职责 | 描述 |
|------|-------------|
| **文件索引** | 索引 `MEMORY.md`、`memory/*.md` 和额外配置的 Markdown 文件 |
| **会话记忆** | 索引会话转录记录（可选的实验性功能） |
| **语义搜索** | 基于向量相似度的语义检索 |
| **关键词搜索** | 基于 BM25 的全文检索（FTS5） |
| **混合检索** | 向量 + 关键词混合排序 |
| **嵌入生成** | 支持 OpenAI、Gemini 和本地嵌入模型 |
| **增量同步** | 文件监听和增量索引更新 |
| **安全读取** | 仅允许访问工作区内的记忆文件 |

## 架构图

```
┌─────────────────────────────────────────────────────────────────┐
│                      配置与初始化层                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ 配置解析    │  │ 嵌入提供器  │  │    插件插槽             │  │
│  │ resolve     │  │ 选择        │  │    memory slot          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MemoryIndexManager                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    数据存储层                            │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │    │
│  │  │ SQLite   │  │ sqlite-  │  │ FTS5                 │   │    │
│  │  │ 元数据   │  │ vec      │  │ 全文索引             │   │    │
│  │  │ 文件表   │  │ 向量表   │  │ BM25 评分            │   │    │
│  │  │ 块表     │  │          │  │                      │   │    │
│  │  └──────────┘  └──────────┘  └──────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    索引管理层                            │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────┐   │    │
│  │  │ 文件监听 │  │ 增量同步 │  │ 批量处理 │  │ 嵌入   │   │    │
│  │  │ chokidar │  │ 差异检测 │  │ 批处理   │  │ 缓存   │   │    │
│  │  └──────────┘  └──────────┘  └──────────┘  └────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    搜索执行层                            │    │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐   │    │
│  │  │ 向量搜索 │  │ 全文搜索 │  │ 混合结果合并         │   │    │
│  │  │ KNN      │  │ BM25     │  │ 加权排序             │   │    │
│  │  └──────────┘  └──────────┘  └──────────────────────┘   │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                      访问接口层                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ Agent 工具  │  │ CLI 命令    │  │    UI 界面              │  │
│  │ memory_     │  │ memory      │  │    状态/搜索            │  │
│  │ search/get  │  │ status/     │  │                         │  │
│  │             │  │ index/search│  │                         │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## 核心组件

### 1. 配置系统 (`src/agents/memory-search.ts`)

记忆系统的配置分层结构：

```typescript
type ResolvedMemorySearchConfig = {
  enabled: boolean;                    // 是否启用
  sources: ("memory" | "sessions")[];  // 数据源
  extraPaths: string[];                // 额外记忆路径
  provider: "openai" | "local" | "gemini" | "auto";  // 嵌入提供器
  remote?: {                           // 远程 API 配置
    baseUrl?: string;
    apiKey?: string;
    headers?: Record<string, string>;
    batch?: {                          // 批量处理配置
      enabled: boolean;
      wait: boolean;
      concurrency: number;
      pollIntervalMs: number;
      timeoutMinutes: number;
    };
  };
  fallback: "openai" | "gemini" | "local" | "none";  // 降级策略
  model: string;                       // 嵌入模型
  local: {                             // 本地模型配置
    modelPath?: string;
    modelCacheDir?: string;
  };
  store: {                             // 存储配置
    driver: "sqlite";
    path: string;
    vector: {
      enabled: boolean;
      extensionPath?: string;
    };
  };
  chunking: {                          // 分块配置
    tokens: number;
    overlap: number;
  };
  sync: {                              // 同步配置
    onSessionStart: boolean;           // 会话开始时同步
    onSearch: boolean;                 // 搜索时同步
    watch: boolean;                    // 监听文件变化
    watchDebounceMs: number;
    intervalMinutes: number;           // 定时同步间隔
    sessions: {                        // 会话增量同步阈值
      deltaBytes: number;
      deltaMessages: number;
    };
  };
  query: {                             // 查询配置
    maxResults: number;
    minScore: number;
    hybrid: {                          // 混合搜索权重
      enabled: boolean;
      vectorWeight: number;
      textWeight: number;
      candidateMultiplier: number;
    };
  };
  cache: {                             // 嵌入缓存
    enabled: boolean;
    maxEntries?: number;
  };
};
```

**配置层级：**

```
agents.defaults.memorySearch    # 全局默认值
agents.list[].memorySearch      # 每个 Agent 的覆盖值
```

**默认值：**

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| `enabled` | `true` | 默认启用 |
| `sources` | `["memory"]` | 仅索引记忆文件（不含会话） |
| `provider` | `"auto"` | 自动选择（local → openai → gemini） |
| `model` | `"text-embedding-3-small"` | OpenAI 默认模型 |
| `chunking.tokens` | `400` | 每块约 400 tokens |
| `chunking.overlap` | `80` | 块间重叠 80 tokens |
| `query.maxResults` | `6` | 默认返回 6 条结果 |
| `query.minScore` | `0.35` | 最小相似度阈值 |
| `query.hybrid.vectorWeight` | `0.7` | 向量权重 70% |
| `query.hybrid.textWeight` | `0.3` | 文本权重 30% |

### 2. 索引管理器 (`src/memory/manager.ts`)

`MemoryIndexManager` 是记忆系统的核心类，管理整个索引生命周期：

#### 2.1 实例化与缓存

```typescript
export class MemoryIndexManager {
  static async get(params: { cfg: OpenClawConfig; agentId: string }): Promise<MemoryIndexManager | null> {
    const key = `${agentId}:${workspaceDir}:${JSON.stringify(settings)}`;
    const existing = INDEX_CACHE.get(key);
    if (existing) return existing;  // 复用缓存实例
    
    const providerResult = await createEmbeddingProvider({...});
    const manager = new MemoryIndexManager({...});
    INDEX_CACHE.set(key, manager);
    return manager;
  }
}
```

**单例模式：** 基于 Agent + 工作区 + 配置的复合键缓存实例，避免重复初始化。

#### 2.2 数据库存储结构

```sql
-- 元数据表
CREATE TABLE meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 文件表
CREATE TABLE files (
  path TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'memory',  -- 'memory' | 'sessions'
  hash TEXT NOT NULL,                      -- 内容哈希
  mtime INTEGER NOT NULL,                  -- 修改时间
  size INTEGER NOT NULL
);

-- 文本块表
CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'memory',
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  hash TEXT NOT NULL,                      -- 文本哈希
  model TEXT NOT NULL,                     -- 嵌入模型
  text TEXT NOT NULL,
  embedding TEXT NOT NULL,                 -- JSON 数组
  updated_at INTEGER NOT NULL
);

-- 嵌入缓存表（跨会话复用）
CREATE TABLE embedding_cache (
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  provider_key TEXT NOT NULL,
  hash TEXT NOT NULL,
  embedding TEXT NOT NULL,
  dims INTEGER,
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (provider, model, provider_key, hash)
);

-- 虚拟向量表（sqlite-vec）
CREATE VIRTUAL TABLE chunks_vec USING vec0(
  id TEXT PRIMARY KEY,
  embedding FLOAT[1536]  -- 维度动态确定
);

-- 虚拟全文表（FTS5）
CREATE VIRTUAL TABLE chunks_fts USING fts5(
  text,
  id UNINDEXED,
  path UNINDEXED,
  source UNINDEXED,
  model UNINDEXED,
  start_line UNINDEXED,
  end_line UNINDEXED
);
```

#### 2.3 文件监听与同步策略

```typescript
// 文件监听（基于 chokidar）
private ensureWatcher() {
  this.watcher = chokidar.watch(watchPaths, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: this.settings.sync.watchDebounceMs,
      pollInterval: 100,
    },
  });
  
  this.watcher.on("add", markDirty);
  this.watcher.on("change", markDirty);
  this.watcher.on("unlink", markDirty);
}

// 会话转录监听
private ensureSessionListener() {
  this.sessionUnsubscribe = onSessionTranscriptUpdate((update) => {
    this.scheduleSessionDirty(sessionFile);
  });
}

// 增量同步策略
async sync(params?: { reason?: string; force?: boolean }) {
  // 1. 检查是否需要全量重建
  const needsFullReindex = force || 
    meta.model !== this.provider.model ||
    meta.provider !== this.provider.id ||
    meta.chunkTokens !== settings.chunking.tokens;
  
  if (needsFullReindex) {
    await this.runSafeReindex();  // 安全重建（临时数据库 → 原子替换）
    return;
  }
  
  // 2. 增量同步记忆文件
  await this.syncMemoryFiles({ needsFullReindex: false });
  
  // 3. 增量同步会话文件（基于脏文件标记）
  await this.syncSessionFiles({ needsFullReindex: false });
}
```

**同步触发条件：**

| 触发条件 | 配置项 | 说明 |
|----------|--------|------|
| 文件变化 | `sync.watch: true` | 监听工作区文件变化 |
| 会话开始 | `sync.onSessionStart: true` | 新会话时预热 |
| 搜索时 | `sync.onSearch: true` | 搜索前自动同步 |
| 定时同步 | `sync.intervalMinutes > 0` | 周期性后台同步 |
| 会话增量 | `sync.sessions.deltaBytes/Messages` | 累积足够变化时同步 |

#### 2.4 安全重建机制

```typescript
private async runSafeReindex(params: {...}): Promise<void> {
  const dbPath = resolveUserPath(this.settings.store.path);
  const tempDbPath = `${dbPath}.tmp-${randomUUID()}`;
  const tempDb = this.openDatabaseAtPath(tempDbPath);
  
  // 1. 在临时数据库上重建
  this.db = tempDb;
  this.ensureSchema();
  await this.syncMemoryFiles({ needsFullReindex: true });
  await this.syncSessionFiles({ needsFullReindex: true });
  
  // 2. 原子替换
  this.db.close();
  originalDb.close();
  await this.swapIndexFiles(dbPath, tempDbPath);
  
  // 3. 重新打开正式数据库
  this.db = this.openDatabaseAtPath(dbPath);
}
```

**安全保证：**
- 在临时数据库上完成所有重建操作
- 保留原始数据库作为备份
- 原子文件交换确保不会损坏生产索引
- 失败时自动回滚到原始数据库

### 3. 嵌入提供器 (`src/memory/embeddings.ts`)

支持多提供商的嵌入生成：

```typescript
export type EmbeddingProvider = {
  id: string;                    // "openai" | "gemini" | "local"
  model: string;                 // 模型标识
  embedQuery: (text: string) => Promise<number[]>;      // 单查询
  embedBatch: (texts: string[]) => Promise<number[][]>; // 批量处理
};
```

#### 3.1 自动选择策略

```typescript
if (requestedProvider === "auto") {
  // 1. 优先尝试本地模型（如果配置了有效路径）
  if (canAutoSelectLocal(options)) {
    try { return await createProvider("local"); } catch {}
  }
  
  // 2. 尝试 OpenAI
  try { return await createProvider("openai"); } catch (err) {
    if (isMissingApiKeyError(err)) continue;
    throw err;
  }
  
  // 3. 尝试 Gemini
  try { return await createProvider("gemini"); } catch {}
  
  throw new Error("No embeddings provider available.");
}
```

#### 3.2 降级机制

```typescript
// 主提供商失败时自动降级
try {
  const primary = await createProvider(requestedProvider);
  return { ...primary, requestedProvider };
} catch (primaryErr) {
  if (fallback && fallback !== "none") {
    const fallbackResult = await createProvider(fallback);
    return {
      ...fallbackResult,
      requestedProvider,
      fallbackFrom: requestedProvider,    // 记录降级来源
      fallbackReason: primaryErr.message, // 记录降级原因
    };
  }
  throw primaryErr;
}
```

#### 3.3 本地嵌入（node-llama-cpp）

```typescript
async function createLocalEmbeddingProvider(options): Promise<EmbeddingProvider> {
  const { getLlama, resolveModelFile } = await import("node-llama-cpp");
  
  const llama = await getLlama({ logLevel: LlamaLogLevel.error });
  const resolved = await resolveModelFile(modelPath, modelCacheDir);
  const embeddingModel = await llama.loadModel({ modelPath: resolved });
  const embeddingContext = await embeddingModel.createEmbeddingContext();
  
  return {
    id: "local",
    model: modelPath,
    embedQuery: async (text) => {
      const embedding = await embeddingContext.getEmbeddingFor(text);
      return Array.from(embedding.vector);
    },
    embedBatch: async (texts) => {
      return Promise.all(texts.map(async (text) => {
        const embedding = await embeddingContext.getEmbeddingFor(text);
        return Array.from(embedding.vector);
      }));
    },
  };
}
```

**默认本地模型：** `hf:ggml-org/embeddinggemma-300M-GGUF/embeddinggemma-300M-Q8_0.gguf`

### 4. 混合搜索 (`src/memory/hybrid.ts`)

结合向量相似度和全文检索的混合搜索：

```typescript
export function mergeHybridResults(params: {
  vector: HybridVectorResult[];     // KNN 结果（余弦相似度）
  keyword: HybridKeywordResult[];   // BM25 结果
  vectorWeight: number;             // 向量权重（默认 0.7）
  textWeight: number;               // 文本权重（默认 0.3）
}): MergedResult[] {
  // 1. 建立 ID → 结果映射
  const byId = new Map<string, MergedEntry>();
  
  // 2. 合并向量结果
  for (const r of vector) {
    byId.set(r.id, { ..., vectorScore: r.vectorScore, textScore: 0 });
  }
  
  // 3. 合并关键词结果（已存在的叠加，不存在的新增）
  for (const r of keyword) {
    const existing = byId.get(r.id);
    if (existing) {
      existing.textScore = r.textScore;
    } else {
      byId.set(r.id, { ..., vectorScore: 0, textScore: r.textScore });
    }
  }
  
  // 4. 加权计算最终分数
  const merged = Array.from(byId.values()).map((entry) => {
    const score = vectorWeight * entry.vectorScore + textWeight * entry.textScore;
    return { ..., score };
  });
  
  // 5. 按分数降序排序
  return merged.toSorted((a, b) => b.score - a.score);
}
```

**BM25 分数转换：**

```typescript
export function bm25RankToScore(rank: number): number {
  const normalized = Number.isFinite(rank) ? Math.max(0, rank) : 999;
  return 1 / (1 + normalized);  // 排名 → 分数（越小排名 = 越高分数）
}
```

**搜索流程：**

```
用户查询
    │
    ├─→ 向量搜索 ──→ KNN (sqlite-vec) ──→ vectorScore (cosine similarity)
    │
    ├─→ 关键词搜索 ──→ BM25 (FTS5) ──→ textScore
    │
    └─→ 结果合并 ──→ hybridScore = 0.7*vectorScore + 0.3*textScore
                        │
                        ▼
                   过滤 (score ≥ minScore)
                        │
                        ▼
                   截断 (maxResults)
                        │
                        ▼
                   返回结果列表
```

### 5. 插件插槽系统 (`src/plugins/slots.ts`)

记忆系统通过插件插槽支持多后端：

```typescript
export type PluginSlotKey = "memory";

const SLOT_BY_KIND: Record<PluginKind, PluginSlotKey> = {
  memory: "memory",
};

const DEFAULT_SLOT_BY_KEY: Record<PluginSlotKey, string> = {
  memory: "memory-core",  // 默认使用内置 memory-core
};

// 排他性插槽选择
export function applyExclusiveSlotSelection(params: {
  config: OpenClawConfig;
  selectedId: string;              // 选中的记忆插件 ID
  selectedKind?: PluginKind;
  registry?: { plugins: SlotPluginRecord[] };
}): SlotSelectionResult {
  // 1. 更新插槽配置
  slots[ slotKey ] = selectedId;
  
  // 2. 禁用同类型的其他插件
  for (const plugin of registry.plugins) {
    if (plugin.kind === "memory" && plugin.id !== selectedId) {
      entries[plugin.id] = { ...entry, enabled: false };
    }
  }
}
```

**可用的记忆插件：**

| 插件 | 类型 | 描述 |
|------|------|------|
| `memory-core` | 内置 | 基于 SQLite + sqlite-vec 的默认实现 |
| `memory-lancedb` | 扩展 | 基于 LanceDB 的向量存储 |

**配置示例：**

```json5
{
  plugins: {
    slots: {
      memory: "memory-core"  // 或 "memory-lancedb"
    },
    entries: {
      "memory-core": {
        enabled: true
      }
    }
  }
}
```

### 6. Agent 工具 (`src/agents/tools/memory-tool.ts`)

记忆系统通过工具暴露给 Agent：

#### 6.1 memory_search

```typescript
{
  label: "Memory Search",
  name: "memory_search",
  description: "Mandatory recall step: semantically search MEMORY.md + memory/*.md...",
  parameters: {
    query: string;           // 搜索查询
    maxResults?: number;     // 最大结果数（可选）
    minScore?: number;       // 最小相似度（可选）
  },
  execute: async (params) => {
    const results = await manager.search(query, { maxResults, minScore });
    return { results, provider, model, fallback };
  }
}
```

**强制召回提示：** 工具描述中明确要求 Agent 在回答关于先前工作、决策、日期、人员、偏好或待办事项的问题前，必须先执行记忆搜索。

#### 6.2 memory_get

```typescript
{
  label: "Memory Get",
  name: "memory_get",
  description: "Safe snippet read from MEMORY.md, memory/*.md...",
  parameters: {
    path: string;            // 文件路径
    from?: number;           // 起始行号（可选）
    lines?: number;          // 行数（可选）
  },
  execute: async (params) => {
    const result = await manager.readFile({ relPath, from, lines });
    return { path, text };
  }
}
```

**安全读取：** 仅允许访问工作区内的 `.md` 文件，额外路径必须通过 `memorySearch.extraPaths` 显式配置。

### 7. CLI 命令 (`src/cli/memory-cli.ts`)

#### 7.1 memory status

```bash
openclaw memory status [--agent <id>] [--deep] [--index] [--json]
```

显示记忆索引状态：
- Provider 和 Model 信息
- 索引文件数和块数
- 向量扩展和 FTS 可用性
- 嵌入缓存统计
- 批处理状态
- 降级信息

#### 7.2 memory index

```bash
openclaw memory index [--agent <id>] [--force] [--verbose]
```

手动触发索引重建：
- 支持强制全量重建 (`--force`)
- 显示进度条和 ETA
- 多 Agent 批量处理

#### 7.3 memory search

```bash
openclaw memory search <query> [--agent <id>] [--max-results <n>] [--min-score <n>]
```

命令行搜索记忆内容。

## 数据流

### 文件索引流程

```
Markdown 文件
     │
     ▼
┌─────────────┐
│ 文件监听    │ ◄── chokidar watch
│ or 手动触发 │
└─────────────┘
     │
     ▼
┌─────────────┐
│ 分块处理    │ ◄── chunkMarkdown()
│ (tokens/    │    - 按 token 数切分
│  overlap)   │    - 保留行号信息
└─────────────┘
     │
     ▼
┌─────────────┐
│ 嵌入生成    │ ◄── embedBatch()
│             │    - 缓存优先
│             │    - 批量请求
└─────────────┘
     │
     ▼
┌─────────────┐
│ 数据库存储  │
│             │    ├─→ files 表（文件元数据）
│             │    ├─→ chunks 表（文本块 + 嵌入 JSON）
│             │    ├─→ chunks_vec（sqlite-vec 虚拟表）
│             │    └─→ chunks_fts（FTS5 虚拟表）
└─────────────┘
```

### 搜索流程

```
用户查询
     │
     ├──────────────────────────────┐
     │                              │
     ▼                              ▼
┌─────────┐                  ┌─────────┐
│嵌入生成 │                  │关键词  │
│(query)  │                  │提取    │
└────┬────┘                  └────┬────┘
     │                              │
     ▼                              ▼
┌─────────┐                  ┌─────────┐
│向量搜索 │                  │FTS5    │
│KNN     │                  │搜索    │
│sqlite- │                  │BM25    │
│vec     │                  │评分    │
└────┬────┘                  └────┬────┘
     │                              │
     └──────────┬───────────────────┘
                │
                ▼
         ┌─────────────┐
         │ 结果合并    │ ◄── 加权计算 hybridScore
         │ hybrid.rs   │
         └──────┬──────┘
                │
                ▼
         ┌─────────────┐
         │ 过滤排序    │ ◄── minScore 阈值
         │ 截断返回    │ ◄── maxResults 限制
         └─────────────┘
```

## 关键文件位置

| 文件路径 | 描述 |
|----------|------|
| `src/memory/index.ts` | 公开 API 导出 |
| `src/memory/manager.ts` | 核心索引管理器 |
| `src/memory/internal.ts` | 内部工具函数（分块、哈希等） |
| `src/memory/search-manager.ts` | 搜索管理器包装器 |
| `src/memory/embeddings.ts` | 嵌入提供器工厂 |
| `src/memory/embeddings-openai.ts` | OpenAI 嵌入实现 |
| `src/memory/embeddings-gemini.ts` | Gemini 嵌入实现 |
| `src/memory/hybrid.ts` | 混合搜索结果合并 |
| `src/memory/manager-search.ts` | 向量/关键词搜索实现 |
| `src/memory/memory-schema.ts` | 数据库 Schema 定义 |
| `src/memory/sqlite-vec.ts` | sqlite-vec 扩展加载 |
| `src/memory/sqlite.ts` | SQLite 工具 |
| `src/agents/memory-search.ts` | 配置解析和合并 |
| `src/agents/tools/memory-tool.ts` | Agent 工具实现 |
| `src/cli/memory-cli.ts` | CLI 命令实现 |
| `src/plugins/slots.ts` | 插件插槽系统 |
| `extensions/memory-lancedb/` | LanceDB 记忆插件 |
| `extensions/memory-core/` | 核心记忆插件 |

## 设计思想

### 1. 渐进式索引

- **按需同步**：仅在搜索时或文件变化时触发索引，避免不必要的计算
- **增量更新**：通过文件哈希检测变化，仅处理变更文件
- **会话增量**：累积足够的变化（字节数或消息数）后再同步会话转录

### 2. 多模态嵌入

- **自动选择**：根据配置和环境自动选择最佳嵌入提供器
- **降级机制**：主提供器失败时自动切换到备用方案
- **本地优先**：支持本地嵌入模型，保护隐私并降低延迟

### 3. 混合检索

- **语义 + 关键词**：结合向量相似度和 BM25 全文检索
- **可配置权重**：用户可调整向量/文本权重比例
- **互补优势**：向量捕捉语义，关键词确保精确匹配

### 4. 安全隔离

- **工作区边界**：仅索引和暴露工作区内的文件
- **显式路径**：额外路径必须通过 `extraPaths` 显式配置
- **符号链接过滤**：自动跳过符号链接防止遍历攻击

### 5. 插件架构

- **插槽系统**：通过 `memory` 插槽支持多后端实现
- **排他性**：同一时刻仅激活一个记忆插件
- **可扩展**：第三方可实现自定义记忆后端

## 实现细节

### 分块策略

```typescript
export function chunkMarkdown(content: string, chunking: { tokens: number; overlap: number }): MemoryChunk[] {
  const maxChars = Math.max(32, chunking.tokens * 4);      // token 转字符（约 4:1）
  const overlapChars = Math.max(0, chunking.overlap * 4);  // 重叠区域
  
  // 按行累积，超过阈值时切分
  // 保留重叠上下文确保语义连贯
  // 记录起始/结束行号用于精确定位
}
```

### 嵌入缓存

```typescript
// 三层缓存策略：
// 1. SQLite 持久化缓存（embedding_cache 表）
//    - 跨会话复用
//    - 基于内容哈希（SHA256）
//    - 包含 provider + model + hash 复合键
//
// 2. 内存缓存（可选）
//    - 运行时速查
//    - LRU 淘汰策略
//
// 3. 批处理优化
//    - 合并多个嵌入请求
//    - 减少 API 调用次数
```

### 并发控制

```typescript
private async runWithConcurrency<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = [];
  const executing: Promise<void>[] = [];
  
  for (const [index, task] of tasks.entries()) {
    const promise = task().then((result) => { results[index] = result; });
    executing.push(promise);
    
    if (executing.length >= concurrency) {
      await Promise.race(executing);
      executing.splice(executing.findIndex((p) => p === promise), 1);
    }
  }
  
  await Promise.all(executing);
  return results;
}
```

### 批处理嵌入

```typescript
// OpenAI Batch API 支持
async function runOpenAiEmbeddingBatches(requests: OpenAiBatchRequest[]) {
  // 1. 上传请求文件
  const fileId = await uploadBatchFile(requests);
  
  // 2. 创建批处理任务
  const batchId = await createBatch(fileId);
  
  // 3. 轮询等待完成
  await pollBatchStatus(batchId, timeoutMs);
  
  // 4. 下载结果
  return await downloadBatchResults(batchId);
}
```

## 相关文档

- [配置参考](/gateway/configuration) - 记忆系统配置选项
- [工具参考](/concepts/tools) - memory_search 和 memory_get 工具
- [CLI 参考](/cli/memory) - 命令行操作指南
- [插件架构](./gateway-architecture.md#通道插件) - 插件系统整体架构
