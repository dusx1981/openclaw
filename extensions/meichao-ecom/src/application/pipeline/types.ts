import type { ProductData, FetchResult } from "../../domain/types.js";

export interface PipelineContext {
  requestId: string;
  platform: string;
  platformIds: string[];
  options: PipelineOptions;
  startTime: number;
  metadata: Record<string, unknown>;
}

export interface PipelineOptions {
  useCache?: boolean;
  skipValidation?: boolean;
  skipDedupe?: boolean;
  skipStore?: boolean;
  forceRefresh?: boolean;
}

export interface PipelineResult {
  success: boolean;
  products: ProductData[];
  errors: PipelineError[];
  stats: PipelineStats;
}

export interface PipelineError {
  stage: string;
  platformId?: string;
  message: string;
  code: string;
}

export interface PipelineStats {
  totalRequested: number;
  fetched: number;
  validated: number;
  deduplicated: number;
  cached: number;
  stored: number;
  failed: number;
  durationMs: number;
}

export interface FilterResult<T> {
  data: T;
  passed: boolean;
  errors: PipelineError[];
}

export interface PipelineFilter {
  name: string;
  execute(context: PipelineContext, input: PipelineFilterInput): Promise<PipelineFilterOutput>;
}

export interface PipelineFilterInput {
  products: ProductData[];
  fetchResults?: Map<string, FetchResult<ProductData>>;
}

export interface PipelineFilterOutput {
  products: ProductData[];
  errors: PipelineError[];
  stats: Partial<PipelineStats>;
}

export type FilterPriority = number;

export const FILTER_PRIORITIES = {
  FETCH: 10,
  VALIDATE: 20,
  DEDUPE: 30,
  CACHE: 40,
  STORE: 50,
} as const;
