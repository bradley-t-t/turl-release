# Changelog

All notable changes to this project will be documented in this file.

## [2.2] - 2026-02-02

- Updated configuration management by replacing `public/version.json` with `public/turl.json` to store version, project name, and branch information
- Enhanced README.md with detailed sections on API key setup, project configuration via `turl.json`, command line options, error handling, and debug mode
- Added comprehensive error handling in `src/cleanup.js` with custom `CleanupError` class and detailed error codes for project root validation and file operations
- Improved release process in `src/index.js` to use configuration from `public/turl.json` and support branch overrides via CLI
- Updated commit message generation to include project name from `public/turl.json` (e.g., "my-project: Release v1.3")
- Expanded error handling documentation in README.md to cover pre-flight checks, API errors, file system errors, Git errors, and build/format errors

## [2.1] - 2026-02-02

- Updated environment variable parsing in `loadEnvFromPath` function in `src/index.js` to handle quoted values by removing surrounding quotes.
- Improved key-value splitting logic in `loadEnvFromPath` by using `indexOf` for finding the equals sign instead of splitting, ensuring more accurate parsing.

## [2.0] - 2026-02-02

- Removed usage of `fileURLToPath` and related constants (`__filename`, `__dirname`, `PACKAGE_ROOT`) in `src/index.js`.
- Simplified environment variable loading logic in `loadEnv()` function by removing package-level `.env` loading and self-project checks in `src/index.js`.
- Updated API key check in `loadEnv()` to support both `GROK_API_KEY` and `REACT_APP_GROK_API_KEY` in `src/index.js`.
- Changed `loadEnv()` to no longer return a source value and removed associated source messaging logic in `main()` function in `src/index.js`.
- Updated API key loading success message to always display "from project .env" in `main()` function in `src/index.js`.

## [1.9] - 2026-02-02

- Updated API key configuration in README.md to require each project to provide its own API key in a `.env` file
- Added instructions in README.md for obtaining API key from https://console.x.ai and adding `.env` to `.gitignore`
- Specified in README.md that the tool uses the `grok-3-latest` model for changelog and commit message generation
- Enhanced README.md with detailed error handling information for release failures due to missing API key or failed Grok API calls
- Added self-release instructions in README.md for running the release from the turl-release directory
- Updated release process in README.md to include staging all changes with `git add -A` and failing on Grok API call errors
- Modified `src/index.js` to prioritize loading `.env` from the project root over the package directory
- Updated error message in `src/index.js` to guide users to add `GROK_API_KEY` to their project's `.env` file and provided the API key source URL
- Removed `.env` from the `files` array in `package.json` to exclude it from the published package
- Updated version in `public/version.json` from 1.7 to 1.8 as part of the release process preparation

## [1.7] - 2026-02-02

- Updated version in public/version.json from 1.3 to 1.6
- Enhanced error handling in src/index.js for changelog and commit message generation by throwing errors instead of using fallback text when no diff is available or API response is invalid
- Removed fallback text for changelog and commit message generation in src/index.js when API key is missing or API fails
- Updated main function in src/index.js to exit with an error message if GROK_API_KEY is not found
- Improved logging messages in src/index.js for API key loading and error scenarios

## [1.3] - 2026-02-02

- Version bump

## [1.2] - 2026-02-02

- Version bump

## [1.1] - 2026-02-02

- Version bump
