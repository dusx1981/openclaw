import { faker } from "@faker-js/faker";
import type { Platform } from "../../src/domain/types.js";
import { Quota, type QuotaData } from "../../src/domain/value-objects/Quota.js";

export function createQuotaData(overrides: Partial<QuotaData> = {}): QuotaData {
  const total = overrides.total ?? faker.number.int({ min: 100, max: 10000 });
  const used = overrides.used ?? faker.number.int({ min: 0, max: total });

  return {
    sourceId: overrides.sourceId ?? `source-${faker.string.alphanumeric(8)}`,
    platform: overrides.platform ?? ("taobao" as Platform),
    total,
    used,
  };
}

export function createQuota(overrides: Partial<QuotaData> = {}): Quota {
  return Quota.create(createQuotaData(overrides));
}

export const QuotaFactory = {
  create: createQuota,
  createData: createQuotaData,
};
