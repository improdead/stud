# Stud

AI-powered development tool for Roblox games.

---

## Development

### Prerequisites

- [Bun](https://bun.sh/) v1.3.5+
- [Rust](https://www.rust-lang.org/tools/install) (for Tauri)
- [Tauri CLI prerequisites](https://tauri.app/start/prerequisites/)

### Setup

```bash
# Install dependencies
bun install

# Run the desktop app in development mode
bun run dev
```

### Project Structure

```
stud/
├── packages/
│   ├── desktop/      # Tauri desktop app shell
│   ├── app/          # SolidJS UI components
│   ├── ui/           # Shared UI component library
│   ├── core/         # AI engine (providers, tools, sessions)
│   ├── util/         # Shared utilities
│   ├── plugin/       # Plugin system
│   └── script/       # Build scripts
├── package.json
├── turbo.json
└── tsconfig.json
```

### Running the App

```bash
# Development mode (hot reload)
bun run dev

# Build for production
bun run build

# Type checking
bun run typecheck
```

### Desktop App Development

The desktop app is built with [Tauri](https://tauri.app/) and [SolidJS](https://solidjs.com/).

```bash
# Run Tauri in development mode
cd packages/desktop
bun run tauri dev

# Build the desktop app
bun run tauri build
```

### Core Engine

The core AI engine (`packages/core`) handles:

- AI model integrations (Anthropic, OpenAI, Google, etc.)
- Tool system (file operations, bash, etc.)
- Session management
- MCP (Model Context Protocol) support
- LSP integration

### Key Technologies

- **Tauri** - Cross-platform desktop app framework
- **SolidJS** - Reactive UI framework
- **Bun** - JavaScript runtime and package manager
- **AI SDK** - Multi-provider AI model integrations
- **Hono** - Lightweight web framework for the local server

---

## License

MIT
