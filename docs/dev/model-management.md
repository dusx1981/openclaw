---
summary: "OpenClaw 大模型管理模块完整技术文档"
title: "大模型管理模块"
---

# 大模型管理模块

本文档详细说明 OpenClaw 大模型管理模块的设计、实现和配置方式。

## 概述

OpenClaw 的大模型管理模块负责：
- 模型提供商的配置和发现
- API 密钥的存储和解析
- 模型目录的构建和缓存
- 模型选择和故障转移
- 认证配置文件管理

## 核心架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Model Catalog                                │
│                    (可用模型列表 + 元数据)                            │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │
│  │ models.json  │  │  Pi SDK      │  │  插件发现    │               │
│  │ (持久化)     │  │ (内置目录)   │  │ (扩展)       │               │
│  └──────────────┘  └──────────────┘  └──────────────┘               │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    Models Config Plan                         │   │
│  │              (配置解析 + 合并 + 规范化)                        │   │
│  └──────────────────────────────────────────────────────────────┘   │
├─────────────────────────────────────────────────────────────────────┤
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐         │
│  │ Model Auth     │  │ Model Selection│  │ Model Fallback │         │
│  │ (认证解析)     │  │ (模型选择)     │  │ (故障转移)     │         │
│  └────────────────┘  └────────────────┘  └────────────────┘         │
└─────────────────────────────────────────────────────────────────────┘
```

## 目录结构

```
src/agents/
├── model-catalog.ts              # 模型目录加载和缓存
├── model-auth.ts                 # API 密钥认证解析
├── model-selection.ts            # 模型选择逻辑
├── model-fallback.ts             # 故障转移机制
├── models-config.ts              # models.json 生成入口
├── models-config.plan.ts         # 配置规划（skip/noop/write）
├── models-config.providers.ts    # 提供商配置解析
├── models-config.providers.discovery.ts  # 自动发现（Ollama, VLLM 等）
├── models-config.providers.static.ts     # 静态提供商配置
├── models-config.merge.ts        # 配置合并逻辑
├── auth-profiles.ts              # 认证配置文件管理
├── model-auth-markers.ts         # 密钥标记（引用环境变量）
└── defaults.ts                   # 默认模型和提供商

src/config/
├── types.models.ts               # 模型配置类型定义
├── model-input.ts                # 模型输入解析
└── zod-schema.agent-model.ts     # Zod 验证 Schema
```

## 核心数据结构

### ModelProviderConfig

```typescript
type ModelProviderConfig = {
  baseUrl: string;              // API 端点
  apiKey?: SecretInput;         // API 密钥（明文或引用）
  auth?: ModelProviderAuthMode; // 认证模式
  api?: ModelApi;               // API 类型
  injectNumCtxForOpenAICompat?: boolean;
  headers?: Record<string, SecretInput>;  // 自定义请求头
  authHeader?: boolean;
  models: ModelDefinitionConfig[];  // 模型定义列表
};
```

### ModelDefinitionConfig

```typescript
type ModelDefinitionConfig = {
  id: string;           // 模型 ID
  name: string;         // 显示名称
  api?: ModelApi;       // 覆盖 API 类型
  reasoning: boolean;   // 是否支持推理
  input: Array<"text" | "image">;  // 输入类型
  cost: {
    input: number;      // 输入 token 成本
    output: number;     // 输出 token 成本
    cacheRead: number;  // 缓存读取成本
    cacheWrite: number; // 缓存写入成本
  };
  contextWindow: number;  // 上下文窗口大小
  maxTokens: number;      // 最大输出 token
  headers?: Record<string, string>;  // 模型级请求头
  compat?: ModelCompatConfig;  // 兼容性配置
};
```

### ModelsConfig

```typescript
type ModelsConfig = {
  mode?: "merge" | "replace";  // 合并模式
  providers?: Record<string, ModelProviderConfig>;
  bedrockDiscovery?: BedrockDiscoveryConfig;
};
```

## 模型配置流程

### 1. 配置加载

```
openclaw.json → ModelsConfig → models.json
                     ↓
              Provider Discovery
                     ↓
              合并 + 规范化
                     ↓
              models.json 持久化
```

### 2. 模型发现

**入口**: `src/agents/models-config.providers.discovery.ts`

| 提供商 | 发现方式 | 说明 |
|--------|----------|------|
| Ollama | `GET /api/tags` | 本地实例自动发现 |
| VLLM | `GET /v1/models` | 本地实例自动发现 |
| SGLang | `GET /v1/models` | 本地实例自动发现 |
| Bedrock | AWS SDK | 动态发现 AWS Bedrock 模型 |
| GitHub Copilot | OAuth Token | 自动获取 Copilot token |
| 插件 | `ProviderPlugin.discovery` | 插件自定义发现 |

### 3. 配置合并

**入口**: `src/agents/models-config.merge.ts`

```typescript
// merge 模式：显式配置覆盖隐式发现
// replace 模式：只使用显式配置

function mergeProviders(params: {
  implicit: Record<string, ProviderConfig>;  // 发现的配置
  explicit: Record<string, ProviderConfig>;  // 用户配置
}): Record<string, ProviderConfig>;
```

### 4. models.json 生成

**入口**: `src/agents/models-config.ts`

```typescript
export async function ensureOpenClawModelsJson(
  config?: OpenClawConfig,
  agentDirOverride?: string,
): Promise<{ agentDir: string; wrote: boolean }>;
```

生成的文件存储在 `~/.openclaw/agents/<agentId>/models.json`。

## 认证管理

### API 密钥来源优先级

```
1. models.json 中的明文 apiKey
2. 环境变量引用标记（如 "env:OPENAI_API_KEY"）
3. 认证配置文件（authProfiles）
4. 自动发现的环境变量
5. OAuth Token（如 GitHub Copilot）
6. AWS SDK 认证（Bedrock）
```

### 密钥标记类型

```typescript
// 环境变量引用
apiKey: "env:OPENAI_API_KEY"

// 文件引用
apiKey: { source: "file", id: "/path/to/keyfile" }

// 执行命令获取
apiKey: { source: "exec", id: "op read op://Private/key" }

// 明文（不推荐）
apiKey: "sk-..."
```

### 认证配置文件

```json5
{
  authProfiles: {
    profiles: [
      {
        name: "openai-main",
        type: "openai",
        apiKey: "env:OPENAI_API_KEY",
      },
      {
        name: "anthropic-work",
        type: "anthropic",
        apiKey: "env:ANTHROPIC_WORK_API_KEY",
      },
    ],
    defaults: {
      openai: ["openai-main"],
      anthropic: ["anthropic-work"],
    },
  },
}
```

## 模型选择

### 模型引用格式

```typescript
// 格式: <provider>/<model>
"openai/gpt-4.1"
"anthropic/claude-opus-4-6"
"ollama/llama3.3:8b"

// 简写（使用默认提供商）
"claude-opus-4-6"  // 自动推断为 anthropic

// 带 Profile
"openai/gpt-4.1@work"  // 使用 work profile
```

### 选择流程

**入口**: `src/agents/model-selection.ts`

```typescript
export function resolveModelRef(
  modelRef: string,
  catalog: ModelCatalogEntry[],
  config?: OpenClawConfig,
): ModelRef | null;
```

1. 解析模型引用字符串
2. 匹配模型目录
3. 验证提供商配置
4. 返回规范化的 `{ provider, model }`

### 默认模型

**入口**: `src/agents/defaults.ts`

```typescript
export const DEFAULT_PROVIDER = "anthropic";
export const DEFAULT_MODEL = "claude-opus-4-6";
```

## 模型故障转移

**入口**: `src/agents/model-fallback.ts`

```json5
{
  agent: {
    model: {
      primary: "anthropic/claude-opus-4-6",
      fallbacks: [
        "openai/gpt-4.1",
        "google/gemini-2.5-pro",
      ],
    },
  },
}
```

### 故障转移条件

- API 错误（rate limit, service unavailable）
- 网络超时
- 模型不可用

### 故障转移策略

```typescript
type FallbackStrategy = {
  maxRetries: number;
  retryDelayMs: number;
  backoffMultiplier: number;
  skipOnAuthError: boolean;  // 认证错误不触发故障转移
};
```

## 源码开发配置示例

### 基础配置：使用 OpenAI

**1. 环境变量方式（推荐）**

```bash
# ~/.bashrc 或 .env
export OPENAI_API_KEY="sk-..."
```

**2. 配置文件方式**

```json5
// ~/.openclaw/openclaw.json
{
  agent: {
    model: "openai/gpt-4.1",
  },
}
```

**3. 完整 models.json（自动生成）**

```json
{
  "providers": {
    "openai": {
      "baseUrl": "https://api.openai.com/v1",
      "apiKey": "env:OPENAI_API_KEY",
      "models": [
        {
          "id": "gpt-4.1",
          "name": "GPT-4.1",
          "reasoning": false,
          "input": ["text", "image"],
          "cost": { "input": 2.0, "output": 8.0, "cacheRead": 0.1, "cacheWrite": 2.5 },
          "contextWindow": 1047576,
          "maxTokens": 32768
        }
      ]
    }
  }
}
```

### 配置本地模型：Ollama

**1. 启动 Ollama 服务**

```bash
ollama serve
ollama pull llama3.3:8b
```

**2. OpenClaw 自动发现**

Ollama 运行时会自动发现模型，无需手动配置：

```json5
// ~/.openclaw/openclaw.json
{
  agent: {
    model: "ollama/llama3.3:8b",
  },
}
```

**3. 生成的 models.json**

```json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://127.0.0.1:11434/v1",
      "apiKey": "ollama-local",
      "models": [
        {
          "id": "llama3.3:8b",
          "name": "llama3.3:8b",
          "reasoning": false,
          "input": ["text"],
          "cost": { "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0 },
          "contextWindow": 128000,
          "maxTokens": 8192
        }
      ]
    }
  }
}
```

### 配置自定义端点：VLLM

**1. 启动 VLLM 服务**

```bash
vllm serve meta-llama/Llama-3.3-70B-Instruct --port 8000
```

**2. 配置 OpenClaw**

```json5
// ~/.openclaw/openclaw.json
{
  agent: {
    model: "vllm/llama-3.3-70b-instruct",
  },

  models: {
    providers: {
      vllm: {
        baseUrl: "http://127.0.0.1:8000/v1",
        models: [
          {
            id: "llama-3.3-70b-instruct",
            name: "Llama 3.3 70B",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 128000,
            maxTokens: 4096,
          },
        ],
      },
    },
  },
}
```

### 配置代理服务：OpenRouter

```json5
// ~/.openclaw/openclaw.json
{
  agent: {
    model: "openrouter/auto",
  },

  models: {
    providers: {
      openrouter: {
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "env:OPENROUTER_API_KEY",
        models: [
          {
            id: "auto",
            name: "Auto (Smart Routing)",
            reasoning: false,
            input: ["text", "image"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 200000,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

环境变量：
```bash
export OPENROUTER_API_KEY="sk-or-..."
```

### 配置多提供商故障转移

```json5
// ~/.openclaw/openclaw.json
{
  agent: {
    model: {
      primary: "anthropic/claude-opus-4-6",
      fallbacks: [
        "openai/gpt-4.1",
        "google/gemini-2.5-pro",
        "ollama/llama3.3:8b",  // 本地兜底
      ],
    },
  },

  authProfiles: {
    profiles: [
      { name: "claude-primary", type: "anthropic", apiKey: "env:ANTHROPIC_API_KEY" },
      { name: "openai-fallback", type: "openai", apiKey: "env:OPENAI_API_KEY" },
      { name: "google-fallback", type: "google", apiKey: "env:GOOGLE_API_KEY" },
    ],
    defaults: {
      anthropic: ["claude-primary"],
      openai: ["openai-fallback"],
      google: ["google-fallback"],
    },
  },
}
```

### 配置自定义 Headers

```json5
// ~/.openclaw/openclaw.json
{
  models: {
    providers: {
      "custom-proxy": {
        baseUrl: "https://proxy.example.com/v1",
        apiKey: "env:CUSTOM_API_KEY",
        headers: {
          "X-Organization": "my-org",
          "X-User-Id": "user-123",
        },
        models: [
          {
            id: "custom-model",
            name: "Custom Model",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 128000,
            maxTokens: 4096,
          },
        ],
      },
    },
  },
}
```

### 配置 AWS Bedrock

```json5
// ~/.openclaw/openclaw.json
{
  agent: {
    model: "amazon-bedrock/anthropic.claude-3-5-sonnet-20241022-v2:0",
  },

  models: {
    bedrockDiscovery: {
      enabled: true,
      region: "us-east-1",
      providerFilter: ["anthropic"],
      refreshInterval: 3600000,  // 1 hour
    },
  },
}
```

环境变量：
```bash
export AWS_PROFILE="my-aws-profile"
# 或
export AWS_ACCESS_KEY_ID="AKIA..."
export AWS_SECRET_ACCESS_KEY="..."
```

### 配置 GitHub Copilot

```json5
// ~/.openclaw/openclaw.json
{
  agent: {
    model: "github-copilot/gpt-4.1",
  },
}
```

OpenClaw 会自动通过 OAuth 获取 GitHub Copilot token，无需手动配置 API 密钥。

### 插件扩展提供商

```typescript
// extensions/my-provider/index.ts
import type { OpenClawPluginApi, ProviderPlugin } from "openclaw/plugin-sdk";
import { emptyPluginConfigSchema } from "openclaw/plugin-sdk";

const myProvider: ProviderPlugin = {
  id: "my-provider",
  label: "My Provider",
  docsPath: "/providers/my-provider",
  aliases: ["my-ai"],

  auth: [
    {
      id: "api-key",
      label: "API Key",
      kind: "api_key",
      run: async (ctx) => {
        const apiKey = await ctx.prompter.prompt("Enter API Key");
        return {
          profiles: [{ profileId: "default", credential: { apiKey } }],
        };
      },
    },
  ],

  discovery: {
    order: "simple",
    run: async (ctx) => {
      const apiKey = ctx.resolveProviderApiKey("my-provider").apiKey;
      if (!apiKey) return null;

      // 获取可用模型列表
      const res = await fetch("https://api.my-provider.com/models", {
        headers: { Authorization: `Bearer ${apiKey}` },
      });
      const data = await res.json();

      return {
        provider: {
          baseUrl: "https://api.my-provider.com/v1",
          apiKey,
          models: data.models.map(m => ({
            id: m.id,
            name: m.name,
            reasoning: m.supports_reasoning ?? false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: m.context_length ?? 128000,
            maxTokens: m.max_output_tokens ?? 4096,
          })),
        },
      };
    },
  },
};

const plugin = {
  id: "my-provider",
  name: "My Provider",
  configSchema: emptyPluginConfigSchema(),
  register(api: OpenClawPluginApi) {
    api.registerProvider(myProvider);
  },
};

export default plugin;
```

## 环境变量参考

| 变量名 | 提供商 | 说明 |
|--------|--------|------|
| `OPENAI_API_KEY` | OpenAI | API 密钥 |
| `ANTHROPIC_API_KEY` | Anthropic | API 密钥 |
| `GOOGLE_API_KEY` | Google | API 密钥 |
| `OPENROUTER_API_KEY` | OpenRouter | API 密钥 |
| `GITHUB_TOKEN` | GitHub Copilot | GitHub token |
| `AWS_PROFILE` | AWS Bedrock | AWS profile |
| `AWS_ACCESS_KEY_ID` | AWS Bedrock | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS Bedrock | AWS secret key |
| `OLLAMA_HOST` | Ollama | 自定义 Ollama 地址 |
| `VLLM_HOST` | VLLM | 自定义 VLLM 地址 |

## 开发配置操作指南

### CLI 命令快速参考

```bash
# 查看可用模型列表
openclaw models list              # 显示已配置模型
openclaw models list --all        # 显示所有可用模型
openclaw models list --provider ollama  # 按提供商筛选
openclaw models list --local      # 只显示本地模型

# 设置默认模型
openclaw models set anthropic/claude-opus-4-6
openclaw models set ollama/llama3.3:8b

# 配置故障转移
openclaw models fallbacks add openai/gpt-4.1
openclaw models fallbacks list
openclaw models fallbacks clear

# 配置认证
openclaw models auth setup-token  # 配置 Anthropic token
openclaw models auth login --provider openai
openclaw models auth add --provider anthropic --api-key "sk-ant-..."

# 查看模型状态
openclaw models status            # 认证状态概览
openclaw models scan              # 扫描模型可用性

# 配置向导
openclaw configure                # 交互式配置
openclaw configure --section model  # 只配置模型
openclaw onboard                  # 完整引导流程
```

### 从零开始配置模型

#### 场景 1: 配置云端模型（OpenAI/Anthropic）

**步骤 1: 设置环境变量（推荐）**

```bash
# 方式一：临时设置
export OPENAI_API_KEY="sk-..."
export ANTHROPIC_API_KEY="sk-ant-..."

# 方式二：写入 shell 配置
echo 'export OPENAI_API_KEY="sk-..."' >> ~/.bashrc
source ~/.bashrc

# 方式三：使用 .env 文件
echo 'OPENAI_API_KEY=sk-...' > ~/.openclaw/.env
```

**步骤 2: 验证配置**

```bash
# 检查模型列表
openclaw models list --provider openai

# 输出示例：
# Provider   Model                    Auth     Context   Reasoning
# openai     gpt-4.1                  ✓        1M        ✗
# openai     gpt-4.1-mini             ✓        1M        ✗
# openai     o3                       ✓        200K      ✓
```

**步骤 3: 设置默认模型**

```bash
openclaw models set openai/gpt-4.1
```

**步骤 4: 测试运行**

```bash
# 快速测试
openclaw agent --message "Hello, what model are you?"

# 或启动交互会话
openclaw
```

#### 场景 2: 配置本地模型（Ollama）

**步骤 1: 安装并启动 Ollama**

```bash
# macOS/Linux
curl -fsSL https://ollama.com/install.sh | sh

# 启动服务
ollama serve

# 拉取模型
ollama pull llama3.3:8b
ollama pull codellama:7b
```

**步骤 2: 验证 Ollama 服务**

```bash
# 检查 Ollama 是否运行
curl http://localhost:11434/api/tags

# 查看已拉取模型
ollama list
```

**步骤 3: OpenClaw 自动发现**

```bash
# OpenClaw 会自动发现 Ollama 模型
openclaw models list --provider ollama

# 输出示例：
# Provider   Model                    Auth     Context   Reasoning
# ollama     llama3.3:8b              ✓        128K      ✗
# ollama     codellama:7b             ✓        16K       ✗
```

**步骤 4: 设置默认模型**

```bash
openclaw models set ollama/llama3.3:8b
```

**步骤 5: 测试运行**

```bash
openclaw agent --message "Explain recursion in one sentence"
```

#### 场景 3: 配置自定义端点（VLLM/SGLang）

**步骤 1: 启动模型服务**

```bash
# VLLM 示例
pip install vllm
vllm serve meta-llama/Llama-3.3-70B-Instruct --port 8000

# SGLang 示例
pip install sglang
python -m sglang.launch_server --model-path meta-llama/Llama-3.3-70B-Instruct --port 30000
```

**步骤 2: 编辑配置文件**

```bash
# 编辑配置
vim ~/.openclaw/openclaw.json
```

```json5
{
  agent: {
    model: "vllm/llama-3.3-70b-instruct",
  },

  models: {
    providers: {
      vllm: {
        baseUrl: "http://127.0.0.1:8000/v1",
        models: [
          {
            id: "llama-3.3-70b-instruct",
            name: "Llama 3.3 70B",
            reasoning: false,
            input: ["text"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 128000,
            maxTokens: 4096,
          },
        ],
      },
    },
  },
}
```

**步骤 3: 验证配置**

```bash
# 检查 models.json 是否正确生成
cat ~/.openclaw/agents/default/models.json

# 验证模型可用
openclaw models list --provider vllm
```

**步骤 4: 测试运行**

```bash
openclaw agent --message "Write a haiku about coding"
```

#### 场景 4: 配置代理服务（OpenRouter）

**步骤 1: 获取 API 密钥**

从 https://openrouter.ai 获取 API 密钥。

**步骤 2: 设置环境变量**

```bash
export OPENROUTER_API_KEY="sk-or-..."
```

**步骤 3: 编辑配置**

```json5
// ~/.openclaw/openclaw.json
{
  agent: {
    model: "openrouter/auto",  // 自动选择最佳模型
  },

  models: {
    providers: {
      openrouter: {
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "env:OPENROUTER_API_KEY",
        models: [
          {
            id: "auto",
            name: "Auto (Smart Routing)",
            reasoning: false,
            input: ["text", "image"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 200000,
            maxTokens: 8192,
          },
        ],
      },
    },
  },
}
```

**步骤 4: 测试**

```bash
openclaw models list --provider openrouter
openclaw agent --message "Hello"
```

### 配置验证方法

#### 1. 检查模型列表

```bash
# 显示所有可用模型及其认证状态
openclaw models list --all

# 输出解释：
# Auth 列:
#   ✓ = 认证已配置
#   ✗ = 认证缺失
#   ? = 状态未知
```

#### 2. 检查认证状态

```bash
# 详细认证状态
openclaw models status

# 输出示例：
# Provider       Profile           Status
# anthropic      claude-primary    ✓ configured
# openai         openai-main       ✓ configured
# ollama         local             ✓ no auth required
```

#### 3. 检查生成的 models.json

```bash
# 查看 models.json 内容
cat ~/.openclaw/agents/default/models.json | jq .

# 检查特定提供商配置
cat ~/.openclaw/agents/default/models.json | jq '.providers.openai'
```

#### 4. 检查配置文件

```bash
# 查看主配置
cat ~/.openclaw/openclaw.json | jq .

# 检查模型配置部分
cat ~/.openclaw/openclaw.json | jq '.models'
cat ~/.openclaw/openclaw.json | jq '.agents.defaults.model'
```

#### 5. 运行诊断

```bash
# 完整诊断
openclaw doctor

# 只检查模型相关
openclaw doctor --category model
```

### 开发调试技巧

#### 1. 启用详细日志

```bash
# 启用调试日志
export OPENCLAW_LOG_LEVEL=debug

# 运行命令查看详细输出
openclaw models list --all 2>&1 | grep -i "model\|provider\|auth"
```

#### 2. 检查环境变量

```bash
# 查看相关环境变量
env | grep -E "API_KEY|OLLAMA|VLLM|AWS"

# 检查 OpenClaw 识别的环境变量
openclaw doctor 2>&1 | grep -i "env"
```

#### 3. 手动触发模型发现

```bash
# 重新生成 models.json
rm ~/.openclaw/agents/default/models.json
openclaw models list

# 强制刷新模型目录
openclaw models scan
```

#### 4. 测试 API 连接

```bash
# 测试 OpenAI API
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# 测试 Ollama API
curl http://localhost:11434/api/tags

# 测试 Anthropic API
curl -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  https://api.anthropic.com/v1/models
```

#### 5. 调试认证配置

```bash
# 查看认证配置文件
cat ~/.openclaw/auth-profiles.json | jq .

# 列出所有配置文件
openclaw models auth order get

# 手动添加认证
openclaw models auth add --provider openai --api-key "sk-test"
```

### 常见问题解决

#### 问题 1: 模型列表为空

```bash
# 症状
openclaw models list
# Provider   Model   Auth   Context   Reasoning
# (empty)

# 原因 1: 没有配置 API 密钥
export OPENAI_API_KEY="sk-..."

# 原因 2: models.json 未生成
rm ~/.openclaw/agents/default/models.json
openclaw models list

# 原因 3: 配置文件格式错误
cat ~/.openclaw/openclaw.json | jq .  # 检查 JSON 语法
```

#### 问题 2: 认证状态显示 ✗

```bash
# 症状
openclaw models list --provider openai
# Provider   Model        Auth   Context   Reasoning
# openai     gpt-4.1      ✗      1M        ✗

# 解决方案 1: 检查环境变量
echo $OPENAI_API_KEY  # 应该输出密钥

# 解决方案 2: 检查配置文件
cat ~/.openclaw/openclaw.json | jq '.models.providers.openai.apiKey'

# 解决方案 3: 使用交互式登录
openclaw models auth login --provider openai
```

#### 问题 3: Ollama 模型未发现

```bash
# 症状
openclaw models list --provider ollama
# (empty)

# 检查 Ollama 服务
curl http://localhost:11434/api/tags
# 如果无响应，启动 Ollama
ollama serve

# 检查环境变量
echo $OLLAMA_HOST  # 可能有自定义设置

# 手动指定 Ollama 地址
export OLLAMA_HOST="http://localhost:11434"
```

#### 问题 4: models.json 生成失败

```bash
# 症状
openclaw models list
# Error: Failed to generate models.json

# 检查目录权限
ls -la ~/.openclaw/agents/

# 手动创建目录
mkdir -p ~/.openclaw/agents/default

# 检查磁盘空间
df -h ~
```

#### 问题 5: 模型调用失败

```bash
# 症状
openclaw agent --message "Hello"
# Error: Model request failed

# 检查 API 密钥是否有效
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# 检查网络连接
ping api.openai.com

# 检查模型 ID 是否正确
openclaw models list | grep gpt
```

#### 问题 6: 故障转移不工作

```bash
# 症状: 主模型失败后没有切换到备用模型

# 检查故障转移配置
openclaw models fallbacks list

# 确保备用模型已配置认证
openclaw models list --all | grep -E "gpt|claude"

# 添加故障转移模型
openclaw models fallbacks add openai/gpt-4.1
```

### 配置文件模板

#### 最小配置（仅 OpenAI）

```json5
// ~/.openclaw/openclaw.json
{
  agent: {
    model: "openai/gpt-4.1",
  },
}
```

环境变量：
```bash
export OPENAI_API_KEY="sk-..."
```

#### 开发配置（多提供商）

```json5
// ~/.openclaw/openclaw.json
{
  agent: {
    model: {
      primary: "anthropic/claude-opus-4-6",
      fallbacks: ["openai/gpt-4.1", "ollama/llama3.3:8b"],
    },
    thinking: "high",
  },

  models: {
    mode: "merge",
    providers: {
      ollama: {
        baseUrl: "http://localhost:11434/v1",
      },
    },
  },

  authProfiles: {
    profiles: [
      { name: "claude-primary", type: "anthropic", apiKey: "env:ANTHROPIC_API_KEY" },
      { name: "openai-fallback", type: "openai", apiKey: "env:OPENAI_API_KEY" },
    ],
    defaults: {
      anthropic: ["claude-primary"],
      openai: ["openai-fallback"],
    },
  },
}
```

环境变量：
```bash
export ANTHROPIC_API_KEY="sk-ant-..."
export OPENAI_API_KEY="sk-..."
```

#### 生产配置（完整示例）

```json5
// ~/.openclaw/openclaw.json
{
  agent: {
    model: {
      primary: "anthropic/claude-opus-4-6",
      fallbacks: [
        "openai/gpt-4.1",
        "google/gemini-2.5-pro",
      ],
    },
    thinking: "high",
  },

  models: {
    mode: "merge",
    providers: {
      openrouter: {
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: "env:OPENROUTER_API_KEY",
        models: [
          { id: "auto", name: "Auto", reasoning: false, input: ["text", "image"],
            cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
            contextWindow: 200000, maxTokens: 8192 },
        ],
      },
    },
    bedrockDiscovery: {
      enabled: true,
      region: "us-east-1",
      providerFilter: ["anthropic"],
    },
  },

  authProfiles: {
    profiles: [
      { name: "claude-primary", type: "anthropic", apiKey: "env:ANTHROPIC_API_KEY" },
      { name: "openai-main", type: "openai", apiKey: "env:OPENAI_API_KEY" },
      { name: "google-main", type: "google", apiKey: "env:GOOGLE_API_KEY" },
    ],
    defaults: {
      anthropic: ["claude-primary"],
      openai: ["openai-main"],
      google: ["google-main"],
    },
  },

  gateway: {
    port: 18789,
    bind: "loopback",
    mode: "local",
  },
}
```

### 相关文档

- [配置示例大全](/dev/configuration-examples)
- [插件系统架构](/dev/plugin-system)
- [认证管理](/configuration/auth-profiles)