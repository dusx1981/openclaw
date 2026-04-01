## 1. Configuration Module

- [x] 1.1 Create `src/infrastructure/config/plugin-config.ts` with setPostgresConfig and setRedisConfig functions
- [x] 1.2 Implement getPostgresConfig() with priority: pluginConfig > env > defaults
- [x] 1.3 Implement getRedisConfig() with priority: pluginConfig > env > defaults
- [x] 1.4 Update default ports to match Docker config (PostgreSQL: 5434, Redis: 6380)

## 2. Storage Module Integration

- [x] 2.1 Modify `postgres.ts` to use getPostgresConfig() instead of inline process.env reads
- [x] 2.2 Add import for plugin-config module in postgres.ts

## 3. Cache Module Integration

- [x] 3.1 Modify `redis.ts` to use getRedisConfig() instead of inline process.env reads
- [x] 3.2 Add import for plugin-config module in redis.ts

## 4. Plugin Entry Point

- [x] 4.1 Modify `index.ts` register() to read api.pluginConfig
- [x] 4.2 Call setPostgresConfig(api.pluginConfig?.postgres) before registering tools
- [x] 4.3 Call setRedisConfig(api.pluginConfig?.redis) before registering tools

## 5. Documentation and Testing

- [x] 5.1 Update `.env.example` with correct default ports
- [x] 5.2 Add unit tests for plugin-config.ts priority logic
- [x] 5.3 Verify plugin loads correctly with and without pluginConfig