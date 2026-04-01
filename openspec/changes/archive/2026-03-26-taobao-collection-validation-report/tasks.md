## 1. Command Structure

- [x] 1.1 Create src/commands/validate.ts with command entry point
- [x] 1.2 Define CLI options (--count, --json, --mask-sensitive, --all)
- [x] 1.3 Add command to extension manifest

## 2. Validation Runner

- [x] 2.1 Create TaobaoValidator extending PlatformValidator
- [x] 2.2 Implement product ID generation for validation
- [x] 2.3 Implement collection loop with configurable count
- [x] 2.4 Add timeout handling per collection

## 3. Statistics Collection

- [x] 3.1 Create src/validation/ValidationStats.ts (StatsCollector)
- [x] 3.2 Implement success rate calculation
- [x] 3.3 Implement per-source statistics tracking
- [x] 3.4 Implement failure reason categorization

## 4. Degradation Tracking

- [x] 4.1 Create src/validation/DegradationTracker.ts
- [x] 4.2 Track source fallback events
- [x] 4.3 Record complete degradation paths
- [x] 4.4 Support fallback tracking in validation

## 5. Sample Collection

- [x] 5.1 Create src/validation/SampleCollector.ts
- [x] 5.2 Collect up to 5 sample products
- [x] 5.3 Implement sensitive data masking

## 6. Report Generation

- [x] 6.1 Create src/validation/ValidationReport.ts
- [x] 6.2 Implement text report formatter
- [x] 6.3 Implement JSON report formatter
- [x] 6.4 Add report sections (summary, rates, degradation, samples, timestamps)

## 7. Platform Support

- [x] 7.1 Create PlatformValidator abstract base class
- [x] 7.2 Create TaobaoValidator implementation
- [x] 7.3 Create AmazonValidator implementation
- [x] 7.4 Create ValidatorRegistry for platform discovery

## 8. Tests

- [x] 8.1 Create TaobaoValidator.test.ts
- [x] 8.2 Create AmazonValidator.test.ts
- [x] 8.3 Create ValidationStats.test.ts
- [x] 8.4 Create DegradationTracker.test.ts
- [x] 8.5 Create SampleCollector.test.ts
- [x] 8.6 Create ValidationReport.test.ts

## 9. Integration

- [x] 9.1 Create run-validation.ts script
- [x] 9.2 Integrate with TaobaoAdapter for real data
- [x] 9.3 Support --all flag for multi-platform validation

## Summary

- **Total Tasks**: 30
- **Status**: Complete
- **Tests**: 44 passing
- **Implementation Date**: 2026-03-26