# Stud

AI-powered development tool for Roblox games. Stud connects to Roblox Studio via a plugin and allows AI to manipulate instances, scripts, properties, and more in real-time.

---

## Quick Start

```bash
# One command to set up and run
./start.sh
```

This will:

1. Check and install prerequisites (Bun, Rust, Rojo)
2. Install dependencies
3. Copy the Studio plugin to your Roblox plugins folder
4. Start the Stud desktop app

### In Roblox Studio

1. Enable HTTP Requests: **Game Settings > Security > Allow HTTP Requests**
2. Click the **Stud** toolbar button to connect
3. Status indicator shows connection state (red/yellow/green)

---

## Features

### Instance Tree / Explorer

Visual tree view of your Roblox game hierarchy with:

- **Dual source support**: Fetches from Rojo project files OR live from Roblox Studio
- **Search functionality**: Filter instances by name or class
- **Click-to-select**: Syncs selection with Roblox Studio
- **File paths**: Shows corresponding Luau files for scripts

### Inspector Panel

When you select an instance in the tree:

- **Script preview**: View syntax-highlighted source code
- **Property inspector**: Live properties fetched from Studio
- **Quick actions**: Add Script, Insert Model, Edit Properties

### Interactive Asset Picker

When searching the toolbox, results are displayed as clickable thumbnail cards:

- **Visual selection**: See asset thumbnails before inserting
- **AI recommendations**: Quick-add suggested assets
- **Batch selection**: Select multiple assets at once

### Integrated Terminal

- Multiple terminal tabs with drag-and-drop reordering
- Tab renaming, clear, and kill actions
- Resizable panel

---

## Studio Tools (13 tools)

| Tool                    | Description                     |
| ----------------------- | ------------------------------- |
| `roblox_get_script`     | Read script source code         |
| `roblox_set_script`     | Replace entire script content   |
| `roblox_edit_script`    | Find-and-replace edit in script |
| `roblox_get_children`   | List children of an instance    |
| `roblox_get_properties` | Get properties of an instance   |
| `roblox_set_property`   | Set a property value            |
| `roblox_create`         | Create a new instance           |
| `roblox_delete`         | Delete an instance              |
| `roblox_clone`          | Clone an instance               |
| `roblox_move`           | Move instance to new parent     |
| `roblox_search`         | Search instances by name/class  |
| `roblox_get_selection`  | Get currently selected objects  |
| `roblox_run_code`       | Execute Luau code in Studio     |

## Bulk Operations (3 tools)

| Tool                       | Description                          |
| -------------------------- | ------------------------------------ |
| `roblox_bulk_create`       | Create multiple instances at once    |
| `roblox_bulk_delete`       | Delete multiple instances at once    |
| `roblox_bulk_set_property` | Set properties on multiple instances |

## Toolbox Tools (3 tools)

| Tool                    | Description                    |
| ----------------------- | ------------------------------ |
| `roblox_toolbox_search` | Search free assets in toolbox  |
| `roblox_asset_details`  | Get details about an asset     |
| `roblox_insert_asset`   | Insert toolbox asset into game |

## Cloud API Tools (9 tools)

| Tool                                 | Description                                  |
| ------------------------------------ | -------------------------------------------- |
| `roblox_universe_info`               | Get experience/universe info                 |
| `roblox_datastore_list`              | List DataStores                              |
| `roblox_datastore_get`               | Read DataStore entry                         |
| `roblox_datastore_set`               | Write DataStore entry                        |
| `roblox_publish_place`               | Publish a place version                      |
| `roblox_ordered_datastore_list`      | List OrderedDataStore entries (leaderboards) |
| `roblox_ordered_datastore_get`       | Get OrderedDataStore entry                   |
| `roblox_ordered_datastore_set`       | Set OrderedDataStore entry                   |
| `roblox_ordered_datastore_increment` | Increment OrderedDataStore entry             |

**Total: 28 Roblox tools**

---

## Roblox Authentication

For authenticated Toolbox API requests:

1. Go to **Settings > Roblox Account**
2. Login with your Roblox account
3. Your session is securely stored and auto-validated

This enables:
- Access to your own assets
- Higher API rate limits
- Authenticated asset details

---

## Project Discovery

Stud automatically detects Roblox projects in your workspace:

| Project Type | Detected By |
| ------------ | ----------- |
| Rojo         | `default.project.json`, `*.project.json` |
| Wally        | `wally.toml` |
| Place files  | `.rbxl`, `.rbxlx`, `.rbxm` |

Toolchain indicators: `aftman.toml`, `selene.toml`, `.luaurc`

---

## Architecture

```
+-----------------------------------------------------------+
|                     STUD DESKTOP                          |
+---------------------------+-------------------------------+
|  Frontend (SolidJS)       |  Sidecar (stud-core)          |
|  localhost:1420           |  localhost:random             |
|                           |                               |
|  28 Roblox Tools ---------+---> Bridge Server :3001       |
|                           |         |                     |
+---------------------------+---------+---------------------+
                                      |
                 +--------------------+--------------------+
                 |                                         |
                 v                                         v
      +--------------------+                +-------------------------+
      |  Roblox Studio     |                |  Roblox APIs            |
      |  Plugin (Luau)     |                |  - toolbox-service      |
      |  Polls :3001       |                |  - Cloud API            |
      +--------------------+                +-------------------------+
```

### How It Works

1. **Stud Desktop** runs a bridge server on `localhost:3001`
2. **Studio Plugin** polls the bridge for pending requests
3. Plugin executes requests and sends responses back
4. AI tools communicate through the bridge seamlessly

### Undo Support

All modifying operations create undo waypoints in Studio:

- Use **Ctrl+Z** to undo any AI changes
- Each tool call creates a separate waypoint

---

## SDK

Stud provides a JavaScript/TypeScript SDK for programmatic access:

```typescript
import { createStud } from "@anthropics/stud-sdk";

// Create client and server
const stud = await createStud();

// Create a session
const session = await stud.client.session.create({
  directory: "/path/to/project"
});

// Send a prompt
const response = await stud.client.session.prompt(session.id, {
  content: "Create a part in Workspace"
});
```

---

## Environment Variables

### Cloud API (Optional)

For DataStore and publishing operations:

```bash
export ROBLOX_API_KEY="your-api-key"
export ROBLOX_UNIVERSE_ID="your-universe-id"
```

To create an API key:

1. Go to [Creator Hub > Open Cloud > API Keys](https://create.roblox.com/dashboard/credentials)
2. Create a key with required permissions (DataStores, Universe, etc.)

---

## Development

### Prerequisites

- [Bun](https://bun.sh/) v1.3.5+
- [Rust](https://www.rust-lang.org/tools/install) (for Tauri)
- [Rojo](https://rojo.space/) (optional, for project sync)
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
│   ├── sdk/          # JavaScript/TypeScript SDK
│   ├── util/         # Shared utilities
│   └── script/       # Build scripts
├── studio-plugin/    # Roblox Studio plugin
├── start.sh          # Quick start script
└── package.json
```

### Building

```bash
# Development mode (hot reload)
bun run dev

# Build for production
./start.sh --build

# Type checking
bun run typecheck

# Check prerequisites only
./start.sh --check
```

### Manual Plugin Installation

Copy `studio-plugin/Stud.server.lua` to your Roblox plugins folder:

- **Windows**: `%LOCALAPPDATA%\Roblox\Plugins\Stud.server.lua`
- **Mac**: `~/Documents/Roblox/Plugins/Stud.server.lua`

---

## Key Technologies

- **Tauri** - Cross-platform desktop app framework
- **SolidJS** - Reactive UI framework
- **Bun** - JavaScript runtime and package manager
- **AI SDK** - Multi-provider AI model integrations
- **Hono** - Lightweight web framework for local server

---

## License

MIT

## Contributors

- **improdead**
- **madebyshaurya**
