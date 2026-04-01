#!/usr/bin/env bun
/**
 * Meichao Ecom 调试脚本
 * 
 * 用法:
 *   bun scripts/debug-meichao.ts                    # 运行完整流程
 *   bun scripts/debug-meichao.ts --test            # 运行测试场景
 *   bun scripts/debug-meichao.ts --trace           # 启用详细追踪
 */

import { TaobaoAdapter } from "../extensions/meichao-ecom/src/infrastructure/adapters/TaobaoAdapter.js";
import { AmazonAdapter } from "../extensions/meichao-ecom/src/infrastructure/adapters/AmazonAdapter.js";
import { DataPipeline } from "../extensions/meichao-ecom/src/application/pipeline/DataPipeline.js";
import { FetchProductUseCase } from "../extensions/meichao-ecom/src/application/use-cases/FetchProductUseCase.js";

const VERBOSE = process.argv.includes("--trace") || process.argv.includes("-v");

function log(stage: string, data?: unknown) {
  const timestamp = new Date().toISOString().split("T")[1].slice(0, 12);
  if (VERBOSE) {
    console.log(`[${timestamp}] [${stage}]`, data ?? "");
  } else {
    console.log(`[${stage}]`, typeof data === "object" ? JSON.stringify(data, null, 2) : data ?? "");
  }
}

function logSeparator(title: string) {
  console.log("\n" + "═".repeat(60));
  console.log(`  ${title}`);
  console.log("═".repeat(60) + "\n");
}

async function debugBasicFetch() {
  logSeparator("场景 1: 基础商品获取");

  log("INIT", "创建 TaobaoAdapter");
  const adapter = TaobaoAdapter.create();

  log("FETCH", { platformId: "12345" });
  const result = await adapter.fetchProduct("12345");

  log("RESULT", {
    success: result.success,
    source: result.source,
    degradationLevel: result.degradationLevel,
    isDegraded: result.isDegraded,
    product: result.data?.title,
    attempts: result.attempts,
  });

  return result;
}

async function debugFallbackFlow() {
  logSeparator("场景 2: 故障转移流程");

  const adapter = TaobaoAdapter.create();

  log("STEP 1", "所有数据源可用");
  console.log("  数据源状态:");
  const sources1 = await adapter.getAvailableDataSources();
  sources1.forEach((s) => console.log(`    ✓ ${s}`));

  log("STEP 2", "禁用主数据源");
  adapter.updateDataSource("taobao_official_api", { isAvailable: false });
  const sources2 = await adapter.getAvailableDataSources();
  console.log("  数据源状态:");
  sources2.forEach((s) => console.log(`    ✓ ${s}`));

  log("FETCH", { platformId: "67890" });
  const result2 = await adapter.fetchProduct("67890");
  log("RESULT", {
    source: result2.source,
    degradationLevel: result2.degradationLevel,
    isDegraded: result2.isDegraded,
  });

  log("STEP 3", "禁用第二个数据源");
  adapter.updateDataSource("taobao_third_party", { isAvailable: false });
  const sources3 = await adapter.getAvailableDataSources();
  console.log("  数据源状态:");
  sources3.forEach((s) => console.log(`    ✓ ${s}`));

  log("FETCH", { platformId: "11111" });
  const result3 = await adapter.fetchProduct("11111");
  log("RESULT", {
    source: result3.source,
    degradationLevel: result3.degradationLevel,
  });

  log("STEP 4", "恢复主数据源");
  adapter.updateDataSource("taobao_official_api", { isAvailable: true });
  const result4 = await adapter.fetchProduct("22222");
  log("RESULT", { source: result4.source, degradationLevel: result4.degradationLevel });

  return [result2, result3, result4];
}

async function debugConfigOverride() {
  logSeparator("场景 3: 配置覆盖");

  log("INIT", "创建带自定义配置的适配器");
  const adapter = TaobaoAdapter.create({
    sourceConfig: {
      primary: "taobao_crawler",
      fallbacks: ["taobao_official_api"],
    },
    settings: {
      maxFallbackSources: 2,
      enableStaleCache: true,
    },
  });

  log("FETCH", { platformId: "config-test", expectedSource: "taobao_crawler" });
  const result = await adapter.fetchProduct("config-test");
  log("RESULT", {
    source: result.source,
    degradationLevel: result.degradationLevel,
    expectedFallback: "taobao_official_api",
  });

  log("DISABLE", "禁用首选源");
  adapter.updateDataSource("taobao_crawler", { isAvailable: false });
  const result2 = await adapter.fetchProduct("config-test-2");
  log("RESULT", {
    source: result2.source,
    degradationLevel: result2.degradationLevel,
    isDegraded: result2.isDegraded,
  });

  return [result, result2];
}

async function debugAllSourcesDown() {
  logSeparator("场景 4: 所有数据源不可用");

  const adapter = TaobaoAdapter.create();

  log("DISABLE", "禁用所有数据源");
  adapter.updateDataSource("taobao_official_api", { isAvailable: false });
  adapter.updateDataSource("taobao_third_party", { isAvailable: false });
  adapter.updateDataSource("taobao_crawler", { isAvailable: false });

  const sources = await adapter.getAvailableDataSources();
  console.log("  数据源状态: 无可用数据源");
  console.log(`  可用数量: ${sources.length}`);

  log("FETCH", { platformId: "should-fail" });
  const result = await adapter.fetchProduct("should-fail");
  log("RESULT", {
    success: result.success,
    error: result.error,
  });

  return result;
}

async function debugAmazon() {
  logSeparator("场景 5: Amazon 适配器");

  log("INIT", "创建 AmazonAdapter");
  const adapter = AmazonAdapter.create();

  log("FETCH", { platformId: "B08N5WRWNW" });
  const result = await adapter.fetchProduct("B08N5WRWNW");
  log("RESULT", {
    success: result.success,
    source: result.source,
    product: result.data?.title,
  });

  return result;
}

async function runTests() {
  logSeparator("运行测试场景");

  const results: Array<{ name: string; passed: boolean }> = [];

  try {
    const r1 = await debugBasicFetch();
    results.push({ name: "基础获取", passed: r1.success === true });
  } catch (e) {
    results.push({ name: "基础获取", passed: false });
  }

  try {
    const r2 = await debugFallbackFlow();
    results.push({ name: "故障转移", passed: r2.every((r) => r.success) });
  } catch (e) {
    results.push({ name: "故障转移", passed: false });
  }

  try {
    const r3 = await debugConfigOverride();
    results.push({ name: "配置覆盖", passed: r3[0].source === "taobao_crawler" });
  } catch (e) {
    results.push({ name: "配置覆盖", passed: false });
  }

  try {
    const r4 = await debugAllSourcesDown();
    results.push({ name: "错误处理", passed: r4.success === false });
  } catch (e) {
    results.push({ name: "错误处理", passed: false });
  }

  try {
    const r5 = await debugAmazon();
    results.push({ name: "Amazon适配器", passed: r5.success === true });
  } catch (e) {
    results.push({ name: "Amazon适配器", passed: false });
  }

  logSeparator("测试结果汇总");

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;

  console.log(`  通过: ${passed}/${results.length}`);
  console.log(`  失败: ${failed}/${results.length}`);
  console.log("");

  results.forEach((r) => {
    console.log(`  ${r.passed ? "✓" : "✗"} ${r.name}`);
  });

  return results;
}

async function main() {
  const args = process.argv.slice(2);

  if (args.includes("--help") || args.includes("-h")) {
    console.log(`
Meichao Ecom 调试脚本

用法:
  bun scripts/debug-meichao.ts [options]

选项:
  --test, -t     运行所有测试场景
  --trace, -v    启用详细追踪输出
  --help, -h     显示帮助信息

示例:
  bun scripts/debug-meichao.ts              # 运行所有场景
  bun scripts/debug-meichao.ts --trace      # 详细输出
  bun scripts/debug-meichao.ts --test       # 仅运行测试
`);
    process.exit(0);
  }

  console.log("\n🔍 Meichao Ecom 调试工具\n");

  if (args.includes("--test") || args.includes("-t")) {
    await runTests();
  } else {
    await debugBasicFetch();
    await debugFallbackFlow();
    await debugConfigOverride();
    await debugAllSourcesDown();
    await debugAmazon();
  }

  logSeparator("完成");
}

main().catch(console.error);