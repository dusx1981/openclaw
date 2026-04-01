import { faker } from "@faker-js/faker";
import type { DataSource, Platform, DataSourceType } from "../../src/domain/types.js";

export function createDataSource(overrides: Partial<DataSource> = {}): DataSource {
  return {
    id: overrides.id ?? `source-${faker.string.alphanumeric(8)}`,
    platform: overrides.platform ?? "taobao",
    type: overrides.type ?? "official_api",
    priority: overrides.priority ?? 1,
    costPerCall: overrides.costPerCall ?? 0.01,
    dailyQuota: overrides.dailyQuota ?? 1000,
    usedQuota: overrides.usedQuota ?? 0,
    isAvailable: overrides.isAvailable ?? true,
    lastError: overrides.lastError,
    lastSuccessAt: overrides.lastSuccessAt,
  };
}

export function createDataSourceList(
  count: number,
  overrides: Partial<DataSource> = {},
): DataSource[] {
  return Array.from({ length: count }, (_, i) =>
    createDataSource({ priority: i + 1, ...overrides }),
  );
}

export const DataSourceFactory = {
  create: createDataSource,
  createList: createDataSourceList,
};
