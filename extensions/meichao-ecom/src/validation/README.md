# Platform Validation Module

Multi-platform data collection validation framework for the meichao-ecom extension.

## Overview

This module provides a modular, extensible validation framework for testing data collection across different e-commerce platforms.

## Architecture

```
PlatformValidator (abstract)
├── TaobaoValidator  → TaobaoAdapter
├── AmazonValidator  → AmazonAdapter
└── (extensible to other platforms)

Supporting modules:
├── ValidationStats    - Statistics collection
├── SampleCollector    - Product sampling
├── DegradationTracker - Fallback tracking
├── ValidationReport   - Report generation
└── ValidatorRegistry  - Platform registration
```

## Usage

### CLI Command

```bash
# Validate single platform
openclaw meichao validate taobao --count 10

# Validate with JSON output
openclaw meichao validate amazon --count 20 --json

# Validate all platforms
openclaw meichao validate --all

# Mask sensitive data
openclaw meichao validate taobao --mask-sensitive
```

### Options

| Option             | Description                       | Default |
| ------------------ | --------------------------------- | ------- |
| `--count`          | Number of products to validate    | 10      |
| `--json`           | Output in JSON format             | false   |
| `--mask-sensitive` | Mask product IDs in output        | false   |
| `--all`            | Validate all registered platforms | false   |

### Programmatic Usage

```typescript
import { TaobaoValidator, ValidationReport } from "@openclaw/meichao-ecom/validation";

const validator = new TaobaoValidator();
const result = await validator.validate({ count: 10 });
const report = ValidationReport.fromResult(result);

console.log(report.toText());
// or
console.log(report.toJSON());
```

## Adding New Platforms

1. Create a new validator extending `PlatformValidator`:

```typescript
import {
  PlatformValidator,
  type ValidationOptions,
  type ValidationResult,
} from "./PlatformValidator.js";

export class NewPlatformValidator extends PlatformValidator {
  constructor() {
    super("newplatform");
  }

  async validate(options: ValidationOptions): Promise<ValidationResult> {
    // Implement validation logic
  }
}
```

2. Register in `ValidatorRegistry.ts`:

```typescript
this.register("newplatform", new NewPlatformValidator());
```

## Output

### Text Report

```
============================================================
Platform Validation Report: TAOBAO
============================================================

## Summary
- Timestamp: 2024-01-15T10:30:00.000Z
- Duration: 5.23s
- Total Requests: 10
- Success Rate: 80.00%
- Successes: 8
- Failures: 2

## Per-Source Statistics
- taobao_official_api (official_api):
  - Total: 5
  - Success Rate: 100.00%
...
```

### JSON Report

```json
{
  "platform": "taobao",
  "timestamp": 1705312200000,
  "duration": 5230,
  "stats": {
    "total": 10,
    "successes": 8,
    "failures": 2,
    "successRate": 80,
    ...
  }
}
```
