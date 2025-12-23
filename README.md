<div align="center">

# opencode-wrapped

**Your year in code, beautifully visualized.**

Generate a personalized "Spotify Wrapped"-style summary of your [OpenCode](https://opencode.ai) usage.

<img src="https://github.com/user-attachments/assets/placeholder.png" alt="OpenCode Wrapped Example" width="600" />

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Bun](https://img.shields.io/badge/Bun-%23000000.svg?logo=bun&logoColor=white)](https://bun.sh)

</div>

---

## Features

- **Comprehensive Stats** — Sessions, messages, tokens, projects, and streaks
- **Activity Heatmap** — GitHub-style visualization of your coding activity
- **Top Models & Providers** — See which AI models you used most
- **Cost Tracking** — Track your OpenCode Zen spending
- **Beautiful Image Generation** — Shareable PNG card with your stats
- **Terminal Image Display** — Native support for Ghostty, Kitty, iTerm2, WezTerm, and Konsole
- **Cross-Platform Clipboard** — Copy your wrapped image with one click

## Installation

### Prerequisites

- [Bun](https://bun.sh) runtime
- [OpenCode](https://opencode.ai) installed and used at least once

### From Source

```bash
# Clone the repository
git clone https://github.com/yourusername/opencode-wrapped.git
cd opencode-wrapped

# Install dependencies
bun install

# Run directly
bun run start

# Or build a standalone binary
bun run build
./dist/opencode-wrapped
```

### Pre-built Binaries

Download the latest release for your platform:

```bash
# macOS (Apple Silicon)
curl -L https://github.com/yourusername/opencode-wrapped/releases/latest/download/opencode-wrapped-darwin-arm64 -o opencode-wrapped
chmod +x opencode-wrapped

# macOS (Intel)
curl -L https://github.com/yourusername/opencode-wrapped/releases/latest/download/opencode-wrapped-darwin-x64 -o opencode-wrapped
chmod +x opencode-wrapped

# Linux (x64)
curl -L https://github.com/yourusername/opencode-wrapped/releases/latest/download/opencode-wrapped-linux-x64 -o opencode-wrapped
chmod +x opencode-wrapped
```

## Usage

```bash
# Generate your wrapped for the current year
opencode-wrapped

# Generate wrapped for a specific year
opencode-wrapped --year 2024

# Show help
opencode-wrapped --help
```

### Options

| Option | Description |
|--------|-------------|
| `--year <YYYY>` | Generate wrapped for a specific year (default: current year) |
| `--help, -h` | Show help message |
| `--version, -v` | Show version number |

## Terminal Support

The wrapped image displays natively in terminals that support inline images:

| Terminal | Protocol | Status |
|----------|----------|--------|
| [Ghostty](https://ghostty.org) | Kitty Graphics | ✅ Full support |
| [Kitty](https://sw.kovidgoyal.net/kitty/) | Kitty Graphics | ✅ Full support |
| [WezTerm](https://wezfurlong.org/wezterm/) | Kitty + iTerm2 | ✅ Full support |
| [iTerm2](https://iterm2.com) | iTerm2 Inline | ✅ Full support |
| [Konsole](https://konsole.kde.org) | Kitty Graphics | ✅ Full support |
| Other terminals | — | ⚠️ Image saved to file only |

## Output

The tool generates:

1. **Terminal Summary** — Quick stats overview in your terminal
2. **PNG Image** — A beautiful, shareable wrapped card saved to `~/opencode-wrapped-{year}.png`
3. **Clipboard** — Optionally copy the image directly to your clipboard

## Data Source

OpenCode Wrapped reads data from your local OpenCode installation:

```
~/.local/share/opencode/
```

No data is sent anywhere. Everything is processed locally.

## Building

### Development

```bash
# Run in development mode with hot reload
bun run dev
```

### Production Build

```bash
# Build for current platform
bun run build

# Build for all platforms
bun run build --all

# Build for specific platforms
bun run build --target linux-x64,darwin-arm64
```

### Available Build Targets

| Platform | Target | Output |
|----------|--------|--------|
| macOS (Apple Silicon) | `darwin-arm64` | `opencode-wrapped-darwin-arm64` |
| macOS (Intel) | `darwin-x64` | `opencode-wrapped-darwin-x64` |
| Linux (x64) | `linux-x64` | `opencode-wrapped-linux-x64` |
| Linux (ARM64) | `linux-arm64` | `opencode-wrapped-linux-arm64` |
| Windows (x64) | `windows-x64` | `opencode-wrapped-windows-x64.exe` |

### Releasing

Releases are automated via GitHub Actions. To create a new release:

```bash
# Tag and push
git tag v1.0.0
git push origin v1.0.0
```

This will automatically build binaries for all platforms and create a GitHub release.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh)
- **Image Generation**: [Satori](https://github.com/vercel/satori) + [Resvg](https://github.com/nicolo-ribaudo/resvg-js)
- **CLI UI**: [@clack/prompts](https://github.com/bombshell-dev/clack)
- **Clipboard**: [@crosscopy/clipboard](https://github.com/CrossCopy/clipboard)
- **Font**: IBM Plex Mono

## Project Structure

```
opencode-wrapped/
├── src/
│   ├── index.ts          # CLI entry point
│   ├── collector.ts      # Data collection from OpenCode
│   ├── stats.ts          # Statistics calculation
│   ├── types.ts          # TypeScript types
│   ├── constants.ts      # Image dimensions, etc.
│   ├── image/
│   │   ├── generator.tsx # Satori + Resvg image generation
│   │   ├── template.tsx  # React template for the card
│   │   ├── heatmap.tsx   # Activity heatmap component
│   │   └── fonts.ts      # Font loading
│   ├── terminal/
│   │   └── display.ts    # Terminal image protocols
│   └── utils/
│       ├── dates.ts      # Date utilities
│       └── format.ts     # Number formatting
├── scripts/
│   └── build.ts          # Cross-platform build script
├── assets/
│   └── fonts/            # IBM Plex Mono font files
├── .github/
│   └── workflows/
│       └── release.yml   # GitHub Actions release workflow
└── dist/                 # Compiled binaries
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License - see [LICENSE](LICENSE) for details.

---

<div align="center">

Made with ❤️ for the [OpenCode](https://opencode.ai) community

</div>
