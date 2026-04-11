---
name: ecom-ai-customer-service
description: 电商AI客服，自动回复用户咨询，意图识别，常见问题自动处理，复杂问题转人工。Use when building automated customer service for e-commerce store.
---

# AI客服 E-commerce AI Customer Service

自动处理用户咨询，分层响应：常见问题自动回复，复杂问题转人工。

## 处理流程

```
用户消息进来
    ↓
意图识别分类
    ↓
├─→ 常见FAQ → 直接自动回复
├─→ 售后问题 → 生成处理建议 + 通知客服
└─→ 复杂问题 → 直接转人工 + 记录上下文
```

## 意图分类体系

| 意图类别          | 说明                                   | 处理方式            |
| ----------------- | -------------------------------------- | ------------------- |
| `faq`             | 常见问题（物流、尺寸、颜色、发货时间） | 自动回复            |
| `return_exchange` | 退换货请求                             | 指引流程 + 通知客服 |
| `complaint`       | 投诉/质量问题                          | 道歉 + 转人工处理   |
| `pre_sale`        | 售前咨询（功能、使用）                 | AI回答 + 可转人工   |
| `payment`         | 支付问题                               | 指引 + 转财务/人工  |
| `complex`         | 复杂/无法识别                          | 直接转人工          |

## FAQ知识库配置

商家可以配置自己的FAQ：

```json
{
  "faq": [
    {
      "question": ["什么时候发货", "几天发货", "发货时间"],
      "answer": "我们一般48小时内发出哦，周末也正常发货的~"
    },
    {
      "question": ["可以退换吗", "退货政策", "退换货"],
      "answer": "支持7天无理由退换货，不影响二次销售就可以哦"
    }
  ],
  "greeting": "欢迎光临！有什么问题可以随时问我~",
  "workingHours": "客服在线时间：9:00-18:00，非工作时间会稍后回复您"
}
```

## Few-Shot 意图识别提示词

```
你是电商客服意图分类器。请将用户消息分类到以下类别之一：
faq, return_exchange, complaint, pre_sale, payment, complex

分类规则：
- faq：常见问题，已经在FAQ知识库中有答案
- return_exchange：用户要求退换货
- complaint：用户投诉、抱怨质量问题
- pre_sale：售前咨询商品信息
- payment：支付相关问题
- complex：其他复杂问题，需要人工处理

用户消息：{{user_message}}

只输出分类结果，不要其他内容。
```

## 多轮会话管理

- 保存上下文会话历史
- 用户转人工后，将上下文一起发给客服
- 支持用户打断，随时转人工

## 部署方式

### 消息接入 message 技能集成

OpenClaw message 插件已经支持各大渠道，直接接入：

```json
{
  "plugins": {
    "entries": {
      "telegram": {
        "enabled": true
      },
      "discord": {
        "enabled": true
      },
      "whatsapp": {
        "enabled": true
      }
    }
  }
}
```

### 电商平台消息接收

两种接入方式：

**方式A：淘宝千牛消息webhook**

```
淘宝千牛 → webhook → OpenClaw → AI处理 → 回复到千牛
```

**方式B：商家独立客服号**

```
用户 → 电商平台聊天 → 商家客服号 → 转发到OpenClaw → AI回复 → 商家客服发送
```

### 完整消息流

```
1. 用户消息进来
   ↓
2. OpenClaw webhook接收事件
   ↓
3. ecom-ai-customer-service 处理
   ↓
   • 意图识别
   • FAQ匹配回复 / 转人工
   ↓
4. 自动回复 → 通过 message 直接回传给电商平台
   ↓
5. 如果转人工 → message 通知商家客服
   • 包含上下文对话历史
   • 包含用户问题
```

## 转人工机制

### 通知商家流程

当分类为 `complex/complaint/return_exchange` 需要转人工时：

```
1. AI先回复用户：
   "您好，这个问题需要帮您转接给人工客服，他会尽快回复您的~"

2. 使用 message 技能发送通知给商家客服：
```

\*\*通知模板：

```
🔔 需要人工介入处理

用户：张三
问题：{user_message
会话历史：
{conversation_history}

分类：{intention

请尽快回复用户。
```

3. 商家客服回复后，继续由商家发送给用户

## Webhook 配置

### 接收消息请求格式

```json
{
  "platform": "taobao",
  "userId": "123456",
  "userNick": "买家张三",
  "messageId": "msg-xxx",
  "content": "什么时候发货？",
  "timestamp": 1610000000
}
```

### 发送回复格式

```json
{
  "success": true,
  "replyToUserId": "123456",
  "content": "我们一般48小时内发出哦，周末也正常发货的~",
  "needHuman": false
}
```

如果 `needHuman: true` 表示需要人工跟进

## 性能预期

- \*\*自动回复覆盖率：80% 常见问题
- \*\*人工转接率：约 20% 复杂问题
- \*\*节省客服工作量：约 60-70%

## 配置示例 (完整配置示例

```json
{
  "enabled": true,
  "webhookUrl": "https://your-taobao-webhook-url/callback",
  "notifyChannel": "telegram",
  "notifyTarget": "@your_agent_username",
  "faq": [
    {
      "questions": ["什么时候发货", "几天发货", "发货时间"],
      "answer": "我们一般48小时内发出哦，周末也正常发货的~"
    },
    {
      "questions": ["可以退换吗", "退货政策", "退换货"],
      "answer": "支持7天无理由退换货，不影响二次销售就可以哦"
    },
    {
      "questions": ["包邮吗", "邮费"],
      "answer": "满99包邮哦，全场包邮呢~"
    }
  ],
  "greeting": "欢迎光临！有什么问题可以随时问我😊",
  "workingHours": "客服在线时间：9:00-18:00，非工作时间会尽快回复您"
}
```

## 实现路径分步

### 第一步：基础功能（1-2天）

1. 配置 FAQ 知识库配置界面
2. 意图识别 LLM 分类实现
3. webhook 接收消息
4. 自动回复输出

### 第二步：转人工通知（1天）

1. message 技能集成
2. 上下文传递给人工客服
3. 测试通知流程

### 第三步：优化（持续）

1. 根据实际对话数据优化意图识别
2. 不断扩充 FAQ 知识库
3. 统计覆盖率统计分析

## 依赖

- `message` - 通知商家/客服，发送自动回复
- `cron` - 定时处理离线消息（非工作时间消息堆积处理
