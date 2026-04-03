# degradation-defaults Spec

## ADDED Requirements

### Requirement: Default values have single source of truth

The system SHALL define all default values for degradation configuration in `types.ts` as the single source of truth.

#### Scenario: Circuit breaker defaults

- **WHEN** no circuit breaker configuration is provided
- **THEN** the system SHALL use `DEFAULT_CIRCUIT_BREAKER_CONFIG` from `types.ts`

#### Scenario: Health probe defaults

- **WHEN** no health probe configuration is provided
- **THEN** the system SHALL use `DEFAULT_HEALTH_PROBE_CONFIG` from `types.ts`

### Requirement: Other modules reference types.ts defaults

The system SHALL have all other modules import and use default values from `types.ts`.

#### Scenario: data-source-config.ts uses types.ts defaults

- **WHEN** `data-source-config.ts` needs default values
- **THEN** it SHALL import `DEFAULT_CIRCUIT_BREAKER_CONFIG` and `DEFAULT_HEALTH_PROBE_CONFIG` from `types.ts`

#### Scenario: degradation.config.ts uses types.ts defaults

- **WHEN** `degradation.config.ts` needs default values
- **THEN** it SHALL import defaults from `types.ts` instead of defining its own

### Requirement: No duplicate default value definitions

The system SHALL NOT have default values defined in multiple locations.

#### Scenario: Removing duplicate circuit breaker config

- **WHEN** reviewing `DEFAULT_DEGRADATION_CONFIG` in `degradation.config.ts`
- **THEN** it SHALL be removed or replaced with reference to `types.ts`

## REMOVED Requirements

### Requirement: Multiple default value sources

**Reason**: Having defaults in multiple files causes inconsistency and maintenance burden. Users and developers cannot determine which default is actually used.

**Migration**: All code should import defaults from `types.ts`:

```typescript
import { DEFAULT_CIRCUIT_BREAKER_CONFIG, DEFAULT_HEALTH_PROBE_CONFIG } from "../../domain/types.js";
```
