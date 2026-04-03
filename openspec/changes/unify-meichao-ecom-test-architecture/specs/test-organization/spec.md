# Test Organization Specification

## ADDED Requirements

### Requirement: Colocated Test Files

The system SHALL place test files in the same directory as the source files they test.

#### Scenario: Unit test file location

- **WHEN** a source file exists at `src/application/AlertService.ts`
- **THEN** its test file MUST be at `src/application/AlertService.test.ts`

#### Scenario: Integration test file location

- **WHEN** an integration test exists for postgres functionality
- **THEN** the test file MUST be at `src/integration/postgres.test.ts`

#### Scenario: Tool test file location

- **WHEN** a tool source file exists at `src/tools/product-fetch-tool.ts`
- **THEN** its test file MUST be at `src/tools/product-fetch-tool.test.ts`

### Requirement: Test Helpers Directory

The system SHALL place test helper utilities in `src/helpers/` directory.

#### Scenario: Helper file location

- **WHEN** a test utility exists for stress testing
- **THEN** the file MUST be at `src/helpers/stress.ts`

#### Scenario: Helper test file location

- **WHEN** a test exists for helper utilities
- **THEN** the test file MUST be at `src/helpers/stress.test.ts`

### Requirement: Test Fixtures Directory

The system SHALL place test fixture data in `src/fixtures/` directory.

#### Scenario: Fixture file location

- **WHEN** test data factories exist
- **THEN** the files MUST be at `src/fixtures/product-factory.ts`

### Requirement: Test Mocks Directory

The system SHALL place test mocks in `src/mocks/` directory.

#### Scenario: Mock file location

- **WHEN** mock implementations exist
- **THEN** the files MUST be at `src/mocks/*.ts`

### Requirement: No Independent Test Directory

The system SHALL NOT have an independent `test/` directory at the extension root.

#### Scenario: Extension test directory structure

- **WHEN** examining an extension directory structure
- **THEN** there MUST NOT be a `test/` directory at the root
- **AND** all test files MUST be under `src/`

### Requirement: No **tests** Directories

The system SHALL NOT use `__tests__` subdirectories for test organization.

#### Scenario: **tests** directory absence

- **WHEN** examining the extension directory structure
- **THEN** there MUST NOT be any `__tests__` directories
- **AND** there MUST NOT be any `src/__tests__/` directories

### Requirement: No Independent Vitest Configuration

The system SHALL NOT have an independent `vitest.config.ts` at the extension root.

#### Scenario: Vitest configuration

- **WHEN** running tests for an extension
- **THEN** the tests MUST use the root `vitest.extensions.config.ts`
- **AND** there MUST NOT be a `vitest.config.ts` in the extension directory

### Requirement: No Independent Setup File

The system SHALL NOT have an independent `test/setup.ts` file.

#### Scenario: Setup file

- **WHEN** running tests for an extension
- **THEN** the tests MUST inherit the root `test/setup.ts`
- **OR** use no setup file if not needed

### Requirement: Dependency Constraints

The system SHALL NOT declare test runner dependencies in extension `package.json`.

#### Scenario: Vitest dependency

- **WHEN** examining an extension's `package.json`
- **THEN** there MUST NOT be a `vitest` dependency

#### Scenario: Coverage dependency

- **WHEN** examining an extension's `package.json`
- **THEN** there MUST NOT be an `@vitest/coverage-v8` dependency

#### Scenario: Testcontainers dependency

- **WHEN** examining an extension's `package.json`
- **THEN** there MUST NOT be a `testcontainers` dependency

### Requirement: Test File Naming Convention

The system SHALL use `.test.ts` suffix for all test files.

#### Scenario: Unit test file naming

- **WHEN** creating a unit test file
- **THEN** the file name MUST end with `.test.ts`

#### Scenario: Integration test file naming

- **WHEN** creating an integration test file
- **THEN** the file name MUST end with `.test.ts`

#### Scenario: E2E test file naming

- **WHEN** creating an end-to-end test file
- **THEN** the file name MUST end with `.e2e.test.ts`

### Requirement: Test File Discovery

The system SHALL ensure all test files are automatically discovered by the wrapper.

#### Scenario: Wrapper discovery

- **WHEN** running `node scripts/test-parallel.mjs --surface extensions`
- **THEN** all `extensions/**/*.test.ts` files are discovered
- **AND** all `extensions/**/*.e2e.test.ts` files are discovered

### Requirement: Relative Import Paths

The system SHALL use correct relative import paths after file migration.

#### Scenario: Helper imports

- **WHEN** a test file imports a helper
- **THEN** the import path MUST be relative from the test file location
- **AND** the path MUST correctly resolve to `src/helpers/`

#### Scenario: Source imports

- **WHEN** a test file imports a source file
- **THEN** the import path MUST be relative (e.g., `./AlertService.js`)
- **AND** the path MUST NOT reach outside the `src/` directory

### Requirement: Test Organization Consistency

The system SHALL maintain consistency with other extensions' test organization.

#### Scenario: Directory structure comparison

- **WHEN** comparing an extension's test structure with other extensions
- **THEN** the structure MUST follow the same pattern as 98.6% of extensions
- **AND** there MUST NOT be deviations like independent `test/` directories
