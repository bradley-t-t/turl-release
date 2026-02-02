# Changelog

All notable changes to this project will be documented in this file.

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

