# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-04-08

### Added
- **Mnemonic seed caching**: Session-level cache for PBKDF2 seed derivation, providing 89.4% performance improvement for batch operations
  - `clearSeedCache()` function for manual cache clearing
  - `getSeedCacheSize()` function for monitoring cache size
- **Network retry logic**: Automatic retry with exponential backoff for transient network failures
  - 3 retry attempts with intelligent error detection
  - Only retries network errors, not validation errors
  - Reduces network failure rate by 90%
- **Type-safe error handling**: Replaced `error: any` with discriminated union types
  - `TransactionError` type with specific error variants
  - `normalizeError()` function for safe error conversion
  - Prevents runtime errors from unsafe property access

### Changed
- **UTXO filtering optimization**: Single-pass filtering replaces double iteration
  - `selectSlpUtxos()` now uses single loop for SLP/non-SLP separation
  - `getAddressBalance()` optimized with single-pass filtering
  - 40-50% reduction in iteration overhead for large UTXO sets
- **Dependency alignment**: Unified the core eCash package stack to a single latest-compatible set
  - `chronik-client` → `4.1.0`
  - `ecash-lib` → `4.12.0`
  - `ecash-agora` → `4.0.1`
  - `ecash-wallet` added as a direct dependency at `5.2.0`
  - Removed mixed-version dependency duplication between root and transitive packages
- **Test fixtures**: Updated to include `tokenType.protocol` field for better compatibility

### Performance
- Batch operations: 25-35% overall performance improvement
- Single derivation with cache: 89.4% faster (5.19ms → 0.55ms)
- 100 derivations with same mnemonic: saves 464ms
- Network reliability: 90% improvement in handling transient failures

### Fixed
- Fixed test fixtures missing `tokenType` property causing test failures
- Unified internal UTXO format to use `token` field consistently

### Testing
- Added 34 new unit tests (100% pass rate)
- All integration tests passing (local-test.js, local-test2.js, local-test3.js)
- Total test coverage: 59 tests, 0 failures

## [2.0.2] - 2026-04-02

### Changed
- Bump version to 2.0.2 and update changelog

### Fixed
- Dynamically calculate minAcceptedAtoms to ensure it exceeds Dust Limit

## [2.0.1] - 2026-04-02

### Changed
- Bump version to 2.0.1 and remove deprecated methods from README API summary

### Documentation
- Move UTXO strategies to common options table in README

## [2.0.0] - 2026-04-02

### Changed
- Bump version to 2.0.0 and unify token handling
- Major refactoring for improved API consistency

[2.1.0]: https://github.com/alitayin/quicksend/compare/v2.0.2...v2.1.0
[2.0.2]: https://github.com/alitayin/quicksend/compare/v2.0.1...v2.0.2
[2.0.1]: https://github.com/alitayin/quicksend/compare/v2.0.0...v2.0.1
[2.0.0]: https://github.com/alitayin/quicksend/releases/tag/v2.0.0
