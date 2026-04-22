# AGENTS.md

## Project Overview
Neutralinojs desktop app for validating EU VAT numbers via VIES API. Supports single validation and batch CSV processing.

## Development Commands
- **Run**: `npm start` (wraps `neu run`)
- **Build**: `npm run build` (wraps `neu build`)

## Architecture & Critical Gotchas
- **CORS Bypass**: VIES API calls use `Neutralino.os.execCommand` with curl. Do not use direct fetch() - it will fail CORS.
- **Batch Concurrency**: CSV validation processes 20 VAT numbers concurrently.
- **Pause/Resume**: Validation state persists in localStorage. Reset state when selecting new CSV.
- **macOS Tray**: System tray disabled on Darwin due to known Neutralino issue #615.
- **vite.config.js**: Configured for Tauri (unused). Ignore - this is a Neutralinojs project.
- **Build Artifacts**: Outputs to `/bin` and `/dist` (both in .gitignore).

## File Structure
- **Entry**: `resources/js/main.js` imports from `app.js`, `vat.js`, `csv.js`
- **Neutralino Client**: `resources/js/neutralino.js` - managed by CLI, don't modify
- **Config**: `neutralino.config.json` - version 6.7.0, multi-platform builds
- **Styling**: Tailwind CSS (no build step configured)
- **Debug Log**: `neutralinojs.log` in root

## Data Flow
- CSV input: `vatNumbers.csv` (format: "EU VAT Number" header, one per line)
- CSV output: `validated_vat_results.csv` (VAT, Valid, Name, Address)

## Platform Build Support
- **macOS**: x64, arm64, universal (minOS: 10.13.0)
- **Windows**: x64
- **Linux**: x64, arm64, armhf

## Development Notes
- No test runner, linter, or formatter configured
- Neutralino binary installed via `@neutralinojs/neu` in package.json
