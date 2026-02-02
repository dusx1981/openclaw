# OpenClaw Excel 处理流程分析

## 概述

本文档详细分析 OpenClaw 项目中处理 Excel 文件（.xlsx、.xls）和 CSV 文件的完整流程。OpenClaw 作为 AI 网关，支持多种文档类型的识别、解析和转换，Excel 文件处理是其中的重要组成部分。

## 1. 文件类型定义与 MIME 映射

### 1.1 MIME 类型定义

**文件**: `src/media/mime.ts`

Excel 相关的 MIME 类型在代码中定义如下：

```typescript
const EXT_BY_MIME: Record<string, string> = {
  // Excel 旧格式 (.xls)
  "application/vnd.ms-excel": ".xls",
  // Excel 新格式 (.xlsx)
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ".xlsx",
  // CSV 文件
  "text/csv": ".csv",
  // ... 其他类型
};
```

### 1.2 扩展名到 MIME 的反向映射

```typescript
const MIME_BY_EXT: Record<string, string> = {
  ...Object.fromEntries(Object.entries(EXT_BY_MIME).map(([mime, ext]) => [ext, mime])),
  ".jpeg": "image/jpeg",
};
```

## 2. MIME 类型检测流程

### 2.1 检测优先级

**文件**: `src/media/mime.ts:114-144`

MIME 检测采用多层回退策略：

1. **文件类型嗅探**（file-type 库）：通过分析文件内容识别类型
2. **扩展名映射**：从文件路径提取扩展名查找 MIME
3. **HTTP Header**：使用 Content-Type 头信息

```typescript
async function detectMimeImpl(opts: {
  buffer?: Buffer;
  headerMime?: string | null;
  filePath?: string;
}): Promise<string | undefined> {
  const ext = getFileExtension(opts.filePath);
  const extMime = ext ? MIME_BY_EXT[ext] : undefined;

  const headerMime = normalizeHeaderMime(opts.headerMime);
  const sniffed = await sniffMime(opts.buffer);

  // 优先使用嗅探到的类型，但避免通用容器类型覆盖特定扩展名映射
  if (sniffed && (!isGenericMime(sniffed) || !extMime)) {
    return sniffed;
  }
  if (extMime) {
    return extMime;
  }
  // ... 回退逻辑
}
```

### 2.2 XLSX 特殊处理

XLSX 文件实际上是 ZIP 压缩包。当文件类型嗅探返回 `application/zip` 时，系统会通过文件扩展名 `.xlsx` 识别出正确的 MIME 类型。

**测试验证** (`src/media/mime.test.ts:43-53`):

```typescript
it("prefers extension mapping over generic zip", async () => {
  const zip = new JSZip();
  zip.file("hello.txt", "hi");
  const buf = await zip.generateAsync({ type: "nodebuffer" });

  const mime = await detectMime({
    buffer: buf,
    filePath: "/tmp/file.xlsx",
  });
  expect(mime).toBe("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
});
```

### 2.3 OOXML 格式嗅探（增强功能）

对于没有扩展名的 XLSX 文件，系统可以通过解析 ZIP 包内的 `[Content_Types].xml` 来识别类型。

**测试验证** (`src/media/store.redirect.test.ts:86-130`):

```typescript
it("sniffs xlsx from zip content when headers and url extension are missing", async () => {
  // 创建模拟的 XLSX ZIP 结构
  const zip = new JSZip();
  zip.file(
    "[Content_Types].xml",
    '<Types><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
  );
  zip.file("xl/workbook.xml", "<workbook/>");
  // ... 检测逻辑
});
```

## 3. 文件存储与持久化

### 3.1 媒体文件存储流程

**文件**: `src/media/store.ts:170-209`

```typescript
export async function saveMediaSource(
  source: string,
  headers?: Record<string, string>,
  subdir = "",
): Promise<SavedMedia> {
  const baseId = crypto.randomUUID();
  if (looksLikeUrl(source)) {
    const tempDest = path.join(dir, `${baseId}.tmp`);
    const { headerMime, sniffBuffer, size } = await downloadToFile(source, tempDest, headers);
    const mime = await detectMime({
      buffer: sniffBuffer,
      headerMime,
      filePath: source,
    });
    const ext = extensionForMime(mime) ?? path.extname(new URL(source).pathname);
    const id = ext ? `${baseId}${ext}` : baseId;
    const finalDest = path.join(dir, id);
    await fs.rename(tempDest, finalDest);
    return { id, path: finalDest, size, contentType: mime };
  }
  // 本地路径处理...
}
```

### 3.2 存储特性

- **文件大小限制**: 5MB (`MEDIA_MAX_BYTES`)
- **目录权限**: `0o700`（仅所有者可读写执行）
- **文件权限**: `0o600`（仅所有者可读写）
- **自动清理**: 默认 2 分钟后过期 (`DEFAULT_TTL_MS`)

## 4. 文件内容提取

### 4.1 输入文件配置

**文件**: `src/media/input-files.ts:97-106`

```typescript
export const DEFAULT_INPUT_FILE_MIMES = [
  "text/plain",
  "text/markdown",
  "text/html",
  "text/csv",          // CSV 支持
  "application/json",
  "application/pdf",
  // 注意：Excel MIME 类型未在默认列表中
];
```

### 4.2 文件内容提取流程

**文件**: `src/media/input-files.ts:338-398`

```typescript
export async function extractFileContentFromSource(params: {
  source: InputFileSource;
  limits: InputFileLimits;
}): Promise<InputFileExtractResult> {
  const { source, limits } = params;
  
  // 1. 获取文件 Buffer
  let buffer: Buffer;
  let mimeType: string | undefined;
  let charset: string | undefined;
  
  if (source.type === "base64") {
    buffer = Buffer.from(source.data, "base64");
  } else if (source.type === "url") {
    const result = await fetchWithGuard({ ... });
    buffer = result.buffer;
  }
  
  // 2. 大小检查
  if (buffer.byteLength > limits.maxBytes) {
    throw new Error(`File too large...`);
  }
  
  // 3. MIME 类型验证
  if (!limits.allowedMimes.has(mimeType)) {
    throw new Error(`Unsupported file MIME type: ${mimeType}`);
  }
  
  // 4. PDF 特殊处理（提取图片/文本）
  if (mimeType === "application/pdf") {
    const extracted = await extractPdfContent({ buffer, limits });
    return { filename, text, images };
  }
  
  // 5. 文本内容解码
  const text = clampText(decodeTextContent(buffer, charset), limits.maxChars);
  return { filename, text };
}
```

## 5. CSV 文件特殊处理

### 5.1 文本 MIME 扩展映射

**文件**: `src/media-understanding/apply.ts:61-75`

```typescript
const TEXT_EXT_MIME = new Map<string, string>([
  [".csv", "text/csv"],
  [".tsv", "text/tab-separated-values"],
  [".txt", "text/plain"],
  [".md", "text/markdown"],
  [".json", "application/json"],
  [".yaml", "text/yaml"],
  [".yml", "text/yaml"],
  // ...
]);
```

### 5.2 分隔符推断

**文件**: `src/media-understanding/apply.ts:192-206`

```typescript
function guessDelimitedMime(text: string): string | undefined {
  if (!text) {
    return undefined;
  }
  const line = text.split(/\r?\n/)[0] ?? "";
  const tabs = (line.match(/\t/g) ?? []).length;
  const commas = (line.match(/,/g) ?? []).length;
  
  // 逗号优先于制表符
  if (commas > 0) {
    return "text/csv";
  }
  if (tabs > 0) {
    return "text/tab-separated-values";
  }
  return undefined;
}
```

### 5.3 扩展的文本 MIME 类型支持

**文件**: `src/media-understanding/apply.ts:51-60`

```typescript
const EXTRA_TEXT_MIMES = [
  "application/xml",
  "text/xml",
  "application/x-yaml",
  "text/yaml",
  "application/yaml",
  "application/javascript",
  "text/javascript",
  "text/tab-separated-values",  // TSV 支持
];
```

## 6. 媒体理解流程中的文件处理

### 6.1 文件块提取流程

**文件**: `src/media-understanding/apply.ts:216-333`

```typescript
async function extractFileBlocks(params: {
  attachments: ReturnType<typeof normalizeMediaAttachments>;
  cache: ReturnType<typeof createMediaAttachmentCache>;
  limits: ReturnType<typeof resolveFileLimits>;
}): Promise<string[]> {
  const blocks: string[] = [];
  
  for (const attachment of attachments) {
    // 1. 尝试从文件名推断 MIME
    const forcedTextMime = resolveTextMimeFromName(attachment.path ?? attachment.url ?? "");
    
    // 2. 获取文件 Buffer
    let bufferResult = await cache.getBuffer({
      attachmentIndex: attachment.index,
      maxBytes: limits.maxBytes,
      timeoutMs: limits.timeoutMs,
    });
    
    // 3. 编码检测（支持 UTF-16）
    const utf16Charset = resolveUtf16Charset(bufferResult?.buffer);
    const textSample = decodeTextSample(bufferResult?.buffer);
    
    // 4. 判断是否为类文本内容
    const textLike = Boolean(utf16Charset) || looksLikeUtf8Text(bufferResult?.buffer);
    
    // 5. 推断分隔符类型（CSV/TSV）
    const guessedDelimited = textLike ? guessDelimitedMime(textSample) : undefined;
    
    // 6. 确定最终 MIME
    const mimeType = textHint ?? normalizeMimeType(rawMime);
    
    // 7. 内容提取
    const extracted = await extractFileContentFromSource({ source, limits });
    
    // 8. 生成 XML 格式的文件块
    blocks.push(
      `<file name="${xmlEscapeAttr(safeName)}" mime="${xmlEscapeAttr(mimeType)}">\n${blockText}\n</file>`
    );
  }
  
  return blocks;
}
```

### 6.2 文件块 XML 格式

提取的文件内容会被包装为 XML 格式插入到消息体中：

```xml
<file name="data.csv" mime="text/csv">
"name","age","city"
"Alice",30,"New York"
"Bob",25,"San Francisco"
</file>
```

## 7. 文件类型分类

**文件**: `src/media/constants.ts`

```typescript
export type MediaKind = "image" | "audio" | "video" | "document" | "unknown";

export function mediaKindFromMime(mime?: string | null): MediaKind {
  if (!mime) {
    return "unknown";
  }
  if (mime.startsWith("image/")) {
    return "image";
  }
  if (mime.startsWith("audio/")) {
    return "audio";
  }
  if (mime.startsWith("video/")) {
    return "video";
  }
  if (mime === "application/pdf") {
    return "document";
  }
  if (mime.startsWith("application/")) {
    return "document";  // Excel 文件归入 document 类别
  }
  return "unknown";
}
```

### 文件大小限制

```typescript
export const MAX_DOCUMENT_BYTES = 100 * 1024 * 1024; // 100MB
```

## 8. 扩展：MSTeams 的 MIME 检测

**文件**: `extensions/msteams/src/media-helpers.ts`

```typescript
export async function getMimeType(url: string): Promise<string> {
  // 处理 data URL
  if (url.startsWith("data:")) {
    const match = url.match(/^data:([^;,]+)/);
    if (match?.[1]) {
      return match[1];
    }
  }

  // 使用共享的 MIME 检测
  const detected = await detectMime({ filePath: url });
  return detected ?? "application/octet-stream";
}
```

## 9. 配置与限制

### 9.1 文件处理配置

**文件**: `src/media-understanding/apply.ts:92-107`

```typescript
function resolveFileLimits(cfg: OpenClawConfig) {
  const files = cfg.gateway?.http?.endpoints?.responses?.files;
  return {
    allowUrl: files?.allowUrl ?? true,
    allowedMimes: normalizeMimeList(files?.allowedMimes, DEFAULT_INPUT_FILE_MIMES),
    maxBytes: files?.maxBytes ?? DEFAULT_INPUT_FILE_MAX_BYTES,      // 5MB
    maxChars: files?.maxChars ?? DEFAULT_INPUT_FILE_MAX_CHARS,      // 200,000
    maxRedirects: files?.maxRedirects ?? DEFAULT_INPUT_MAX_REDIRECTS, // 3
    timeoutMs: files?.timeoutMs ?? DEFAULT_INPUT_TIMEOUT_MS,         // 10s
    pdf: {
      maxPages: files?.pdf?.maxPages ?? DEFAULT_INPUT_PDF_MAX_PAGES,    // 4
      maxPixels: files?.pdf?.maxPixels ?? DEFAULT_INPUT_PDF_MAX_PIXELS, // 4,000,000
      minTextChars: files?.pdf?.minTextChars ?? DEFAULT_INPUT_PDF_MIN_TEXT_CHARS, // 200
    },
  };
}
```

### 9.2 用户可配置项

```yaml
# 示例配置
gateway:
  http:
    endpoints:
      responses:
        files:
          allowUrl: true
          allowedMimes:
            - "text/csv"
            - "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          maxBytes: 5242880  # 5MB
          maxChars: 200000
          maxRedirects: 3
          timeoutMs: 10000
```

## 10. 流程图

### 10.1 Excel/CSV 文件处理完整流程

```
┌─────────────────────────────────────────────────────────────────┐
│                    Excel/CSV 文件接收                            │
│              (URL 下载 / Base64 解码 / 本地路径)                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    文件类型检测 (MIME)                          │
├─────────────────────────────────────────────────────────────────┤
│  1. 文件扩展名 (.xlsx/.xls/.csv) → 直接映射 MIME                │
│  2. file-type 库嗅探 → 识别 ZIP/XLSX                            │
│  3. [Content_Types].xml 解析 → OOXML 深度检测                   │
│  4. HTTP Content-Type 头 → 回退方案                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    媒体文件存储                                  │
├─────────────────────────────────────────────────────────────────┤
│  • 存储位置: ~/.openclaw/media/                                 │
│  • 文件命名: {sanitized}---{uuid}.{ext}                         │
│  • 权限设置: 目录 0o700, 文件 0o600                             │
│  • 自动清理: 2 分钟 TTL                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    媒体理解阶段                                  │
├─────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Image      │  │   Audio      │  │   Video      │          │
│  │  (vision)    │  │(transcribe)  │  │ (describe)   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                              │                                  │
│                              ▼                                  │
│  ┌────────────────────────────────────────────────────────────┐│
│  │               File 处理 (Document)                          ││
│  ├────────────────────────────────────────────────────────────┤│
│  │  • CSV/TSV: 分隔符推断 (逗号优先于制表符)                   ││
│  │  • 编码检测: UTF-8 / UTF-16LE / UTF-16BE                    ││
│  │  • 文本提取: 最大 200K 字符                                 ││
│  │  • XML 格式化: <file name="..." mime="...">                 ││
│  └────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    内容注入到消息上下文                          │
├─────────────────────────────────────────────────────────────────┤
│  Body: 用户消息 + <file> 块                                     │
│  MediaUnderstanding: 处理决策记录                               │
│  AppliedFile: true (标记文件已处理)                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    LLM 模型处理                                  │
│              (文本内容 + 文件块 XML)                             │
└─────────────────────────────────────────────────────────────────┘
```

## 11. 测试覆盖

### 11.1 MIME 检测测试

- **测试文件**: `src/media/mime.test.ts`
- **测试文件**: `src/media/store.test.ts`
- **测试文件**: `src/media/store.redirect.test.ts`

### 11.2 CSV 处理测试

- **测试文件**: `src/media-understanding/apply.test.ts`

```typescript
// CSV 检测测试
it("treats text-like audio attachments as CSV (comma wins over tabs)", async () => {
  // 验证逗号分隔符识别
});

it("infers TSV when tabs are present without commas", async () => {
  // 验证制表符分隔符识别
});
```

### 11.3 MSTeams 集成测试

- **测试文件**: `extensions/msteams/src/media-helpers.test.ts`

## 12. 关键要点总结

### 12.1 Excel 文件处理特点

| 特性 | 说明 |
|------|------|
| **XLSX 识别** | 基于扩展名 + ZIP 内容双重检测 |
| **XLS 支持** | 传统二进制格式，通过 MIME 映射识别 |
| **内容提取** | **不解析 Excel 结构**，作为二进制文档处理 |
| **CSV 优先** | CSV 作为文本文件直接提取内容 |

### 12.2 安全考虑

1. **文件大小限制**: 防止大文件攻击（默认 5MB）
2. **权限控制**: 严格的文件系统权限（0o600/0o700）
3. **临时文件清理**: 自动过期清理机制
4. **URL 验证**: SSRF 防护和重定向限制
5. **字符转义**: XML 属性值转义防止注入

### 12.3 限制与注意事项

1. **Excel 结构不解析**: OpenClaw 不解析 Excel 的单元格、公式、图表等结构，仅作为二进制文档存储
2. **CSV 是纯文本**: CSV 文件内容直接作为文本提取并注入到消息中
3. **编码自动检测**: 支持 UTF-8、UTF-16LE、UTF-16BE 自动识别
4. **分隔符推断**: CSV 使用逗号，TSV 使用制表符，优先识别逗号

## 13. 相关代码文件

| 文件路径 | 职责 |
|---------|------|
| `src/media/mime.ts` | MIME 类型检测与映射 |
| `src/media/store.ts` | 媒体文件存储管理 |
| `src/media/constants.ts` | 媒体类型定义与分类 |
| `src/media/input-files.ts` | 输入文件内容提取 |
| `src/media-understanding/apply.ts` | 媒体理解主流程 |
| `src/media-understanding/runner.ts` | 媒体理解执行器 |
| `extensions/msteams/src/media-helpers.ts` | MSTeams 媒体辅助 |

## 14. 结论

OpenClaw 对 Excel 文件的处理遵循以下原则：

1. **识别准确**: 通过多层检测确保正确识别 XLSX/XLS/CSV 类型
2. **存储安全**: 严格的权限控制和清理机制
3. **内容简洁**: CSV 作为文本直接注入，Excel 作为文档处理
4. **扩展灵活**: 通过 MIME 列表配置支持更多文件类型

这种设计在保证安全性的同时，为用户提供了灵活的文档处理能力，使 AI 能够理解并响应包含表格数据的查询。
