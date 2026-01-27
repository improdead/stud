# Current Issue: "Could not connect to server"

## Summary

The Tauri desktop app builds and launches successfully, but displays a "Could not connect to server" error in the UI even though the sidecar server is running and responding correctly.

## What's Working

- Core binary builds as `stud`
- Tauri desktop app compiles and launches
- Sidecar server starts on a random port (e.g., 58024)
- Bridge server starts on localhost:3001
- Vite frontend starts on localhost:1420
- Server authentication works when tested manually:
  ```bash
  curl -s http://127.0.0.1:PORT/global/health  # Returns 401 Unauthorized
  curl -s -u opencode:PASSWORD http://127.0.0.1:PORT/global/health  # Returns healthy
  ```

## Root Cause Analysis

### Error Origin

The error is shown in `packages/app/src/context/global-sync.tsx` lines 866-879:

```typescript
async function bootstrap() {
  const health = await globalSDK.client.global
    .health()
    .then((x) => x.data)
    .catch(() => undefined)
  if (!health?.healthy) {
    showToast({
      variant: "error",
      title: language.t("dialog.server.add.error"),
      description: language.t("error.globalSync.connectFailed", { url: globalSDK.url }),
    })
    // ...
  }
}
```

### Auth Flow

1. `packages/desktop/src/index.tsx` line 337: Creates `serverPassword` signal (starts as `null`)
2. Line 338: Creates `platform` with a password accessor: `createPlatform(() => serverPassword())`
3. Line 358-366: `ServerGate` waits for `ensure_server_ready` to resolve, then:
   - Calls `setServerPassword(data().password)` to set the signal
   - Renders `<AppInterface defaultUrl={data().url} />`
4. `AppInterface` renders the provider hierarchy: `ServerProvider` → `GlobalSDKProvider` → `GlobalSyncProvider`
5. `GlobalSyncProvider` calls `bootstrap()` in `onMount()` which calls the health check

### The Fetch Function (with debug logging)

Located in `packages/desktop/src/index.tsx` lines 299-318:

```typescript
fetch: (input, init) => {
  const pw = password() // Calls accessor to get current password
  console.log("[Stud Fetch] Request:", typeof input === "string" ? input : input.url, "Password set:", !!pw)

  const addHeader = (headers: Headers, password: string) => {
    headers.append("Authorization", `Basic ${btoa(`opencode:${password}`)}`)
  }
  // ... adds auth header if pw is set, then calls tauriFetch
}
```

### Suspected Issue

The password signal accessor might not be returning the password when the SDK makes requests. Possible causes:

1. **Timing issue**: The SDK's event stream starts immediately in `GlobalSDKProvider` (line 70-93) via an async IIFE. This makes a request before the component fully mounts.

2. **SolidJS reactivity**: The `platform` object is created once with the accessor. If there's any caching or the accessor isn't being called at the right time, the password would be `null`.

3. **Effect ordering**: `ServerProvider` has a `createEffect` (lines 110-139) that calls `check(url)` which creates an SDK and calls health. This might fire before the password is properly set.

## Key Files

| File                                       | Purpose                                                     |
| ------------------------------------------ | ----------------------------------------------------------- |
| `packages/desktop/src/index.tsx`           | Desktop entry, creates platform with fetch & password       |
| `packages/app/src/context/global-sync.tsx` | Where the error is shown, calls health check                |
| `packages/app/src/context/global-sdk.tsx`  | Creates SDK client with platform.fetch, starts event stream |
| `packages/app/src/context/server.tsx`      | Server context, also does health checks                     |
| `packages/sdk/js/src/v2/client.ts`         | SDK client creation                                         |

## Debugging Steps

1. **Check browser devtools console** in the Tauri webview for the `[Stud Fetch]` debug output
   - If "Password set: false" appears, the signal isn't being read correctly
   - If "Password set: true" but still failing, the issue is elsewhere

2. **Potential fixes to try**:
   - Delay SDK initialization until password is confirmed set
   - Make the SDK client creation reactive to the password
   - Add a guard in `GlobalSDKProvider` to wait for password before starting event stream

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    STUD DESKTOP (Tauri)                         │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Vite + SolidJS)     │  Sidecar Binary (stud-core)   │
│  localhost:1420                 │  localhost:58024 (random)     │
│                                 │                               │
│  @stud/app + @stud/ui          │  @stud/core (AI engine)       │
│         │                       │         │                     │
│         └───── HTTP/WS ─────────┘         │                     │
│            (needs Basic Auth)             │                     │
│                              Bridge Server (localhost:3001)     │
└─────────────────────────────────────────────────────────────────┘
```

## Commands

```bash
# Run the desktop app
cd /Users/shauryagupta/Downloads/opencode/packages/desktop && bunx tauri dev

# Check if sidecar is running
ps aux | grep stud-core | grep -v grep

# Test health endpoint (replace PORT with actual port)
curl -s http://127.0.0.1:PORT/global/health
curl -s -u opencode:PASSWORD http://127.0.0.1:PORT/global/health
```
