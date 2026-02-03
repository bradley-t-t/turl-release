# Changelog

All notable changes to this project will be documented in this file.

## [2.6] - 2026-02-03

- Updated README.md with a restructured layout, renaming "Setup" to "Quick Start" for clearer onboarding.
- Enhanced documentation in README.md with more detailed tables for configuration fields and workflow steps.
- Added explicit instructions in README.md for overriding the branch with command-line options.
- Improved error handling descriptions in README.md, including additional error categories like server errors for API issues.
- Clarified project structure requirements in README.md, specifying the minimum needed files and their purpose.
- Updated commit message and changelog format examples in README.md to reflect AI-generated content based on actual code changes.
- Added emphasis in README.md on strict mode behavior, ensuring releases fail if API key issues or changelog generation fails, preventing generic commits.

## [2.5] - 2026-02-02

- Updated README.md with a new structure including a Table of Contents for better navigation.
- Added detailed sections in README.md for Installation, Setup, Usage, Configuration, What It Does, Error Handling, and Supported Projects.
- Enhanced documentation in README.md with clearer instructions for setting up `.env` file and `turl.json` configuration.
- Updated the commit message format example in README.md to include more detailed changelog entries.
- Added a new "Version Rollback" feature description in README.md for handling failures after version updates.
- Included a "Debug Mode" section in README.md with instructions for running the tool in debug mode.
- Revised error handling documentation in README.md to categorize and list specific errors handled by the tool.
- Updated supported environment variable names in README.md to include `REACT_APP_GROK_API_KEY` as a fallback for API key.
- Added a pre-flight checks step in the "What It Does" section of README.md to ensure git, remote, and node_modules are ready before release.

## [2.4] - 2026-02-02

- Added LICENSE.md file with the full MIT License text
- Updated license information in README.md to reference MIT License and link to LICENSE.md
- Changed license field in package.json from ISC to MIT
- Updated author field in package.json to "Trent"

## [2.3] - 2026-02-02

- Updated README.md with a new tagline and reorganized content for clarity
- Simplified installation instructions in README.md to focus on dev dependency installation
- Added Quick Start section in README.md with streamlined setup steps
- Refined Configuration section in README.md to separate API key and project config details with improved formatting
- Updated Usage section in README.md to include basic release commands and branch override examples
- Reformatted "What It Does" section in README.md into a concise table format
- Added Project Structure section in README.md to outline required project files
- Enhanced Error Handling section in README.md with a categorized table of errors
- Added Supported Projects section in README.md listing compatible project types
- Updated public/turl.json to change default projectName from "my-project" to "my-app"

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
