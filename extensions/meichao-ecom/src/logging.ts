import { createSubsystemLogger } from "../../../src/logging/subsystem.js";

export const pipelineLog = createSubsystemLogger("meichao-ecom/pipeline");
export const fetchLog = pipelineLog.child("fetch");
export const validateLog = pipelineLog.child("validate");
export const dedupeLog = pipelineLog.child("dedupe");
export const storeLog = pipelineLog.child("store");
export const cacheLog = pipelineLog.child("cache");

export const adapterLog = createSubsystemLogger("meichao-ecom/adapter");
export const taobaoLog = adapterLog.child("taobao");
export const amazonLog = adapterLog.child("amazon");

export const serviceLog = createSubsystemLogger("meichao-ecom/service");
export const quotaLog = serviceLog.child("quota");
export const alertLog = serviceLog.child("alert");

export const registryLog = createSubsystemLogger("meichao-ecom/registry");
