# Docker Test Helper Specification

## ADDED Requirements

### Requirement: Run Docker Commands

The system SHALL provide a function to run Docker commands with timeout and error handling.

#### Scenario: Successful Docker command execution

- **WHEN** calling `runDockerCommand(["version"])`
- **THEN** the function returns an object with `code`, `stdout`, and `stderr`
- **AND** `code` is 0 on success

#### Scenario: Docker command timeout

- **WHEN** calling `runDockerCommand(["run", ...], { timeoutMs: 5000 })`
- **AND** the command takes longer than 5000ms
- **THEN** the child process is killed with SIGKILL
- **AND** the promise rejects with a timeout error

#### Scenario: Docker command failure

- **WHEN** calling `runDockerCommand(["invalid-command"], { allowFailure: true })`
- **AND** the command exits with non-zero code
- **THEN** the function returns with `code` being the exit code
- **AND** `stdout` and `stderr` contain the output

### Requirement: Check Docker Availability

The system SHALL provide a function to check if Docker is running and accessible.

#### Scenario: Docker is available

- **WHEN** calling `dockerReady()`
- **AND** Docker daemon is running
- **THEN** the function returns `true`

#### Scenario: Docker is not available

- **WHEN** calling `dockerReady()`
- **AND** Docker daemon is not running
- **THEN** the function returns `false`

### Requirement: Start PostgreSQL Container

The system SHALL provide a function to start a PostgreSQL container for integration testing.

#### Scenario: Start PostgreSQL successfully

- **WHEN** calling `startPostgres()`
- **AND** Docker is available
- **THEN** a PostgreSQL 16 container is started
- **AND** the function returns an object with `containerId`, `host`, and `port`
- **AND** the container is configured with database `meichao_test`, user `test`, password `test`

#### Scenario: PostgreSQL container port mapping

- **WHEN** calling `startPostgres()`
- **THEN** the container's port 5432 is mapped to a random available host port
- **AND** the returned `port` is the mapped host port

#### Scenario: PostgreSQL connection

- **WHEN** a PostgreSQL container is started
- **THEN** the container accepts connections within 10 seconds
- **AND** the database `meichao_test` exists

### Requirement: Start Redis Container

The system SHALL provide a function to start a Redis container for integration testing.

#### Scenario: Start Redis successfully

- **WHEN** calling `startRedis()`
- **AND** Docker is available
- **THEN** a Redis 7 container is started
- **AND** the function returns an object with `containerId`, `host`, and `port`

#### Scenario: Redis container port mapping

- **WHEN** calling `startRedis()`
- **THEN** the container's port 6379 is mapped to a random available host port
- **AND** the returned `port` is the mapped host port

### Requirement: Stop Container

The system SHALL provide a function to stop and remove a Docker container.

#### Scenario: Stop container successfully

- **WHEN** calling `stopContainer(containerId)`
- **THEN** the container is stopped
- **AND** the container is removed (if started with `--rm` flag)

#### Scenario: Stop non-existent container

- **WHEN** calling `stopContainer("invalid-id")`
- **THEN** the function does not throw an error
- **AND** any errors are logged

### Requirement: Allocate Local Port

The system SHALL provide a function to allocate a random available local port.

#### Scenario: Allocate port successfully

- **WHEN** calling `allocatePort()`
- **THEN** an available port number is returned
- **AND** the port is bound to 127.0.0.1 temporarily

### Requirement: Environment Variable Control

The system SHALL respect environment variables for conditional test execution.

#### Scenario: Integration tests disabled by default

- **WHEN** `OPENCLAW_MEICHAO_INTEGRATION` is not set or not "1"
- **THEN** integration tests are skipped using `it.runIf(false)`

#### Scenario: Integration tests enabled

- **WHEN** `OPENCLAW_MEICHAO_INTEGRATION=1`
- **THEN** integration tests run using `it.runIf(true)`

### Requirement: Resource Cleanup

The system SHALL ensure Docker containers are cleaned up after tests.

#### Scenario: Automatic cleanup on test success

- **WHEN** a test using `startPostgres()` completes successfully
- **THEN** the container is stopped and removed

#### Scenario: Automatic cleanup on test failure

- **WHEN** a test using `startPostgres()` fails or throws an error
- **THEN** the container is still stopped and removed
- **AND** no container resources are leaked

#### Scenario: Cleanup on process interruption

- **WHEN** the test process is killed (SIGTERM or SIGKILL)
- **THEN** containers started with `--rm` flag are automatically removed by Docker
