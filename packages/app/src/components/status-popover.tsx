import { createEffect, createMemo, createSignal, For, onCleanup, onMount, Show } from "solid-js"
import { createStore, reconcile } from "solid-js/store"
import { useNavigate } from "@solidjs/router"
import { useDialog } from "@stud/ui/context/dialog"
import { Popover } from "@stud/ui/popover"
import { Tabs } from "@stud/ui/tabs"
import { Button } from "@stud/ui/button"
import { Switch } from "@stud/ui/switch"
import { Icon } from "@stud/ui/icon"
import { Tooltip } from "@stud/ui/tooltip"
import { useSync } from "@/context/sync"
import { useSDK } from "@/context/sdk"
import { normalizeServerUrl, serverDisplayName, useServer } from "@/context/server"
import { usePlatform } from "@/context/platform"
import { useLanguage } from "@/context/language"
import { createOpencodeClient } from "@stud/sdk/v2/client"
import { DialogSelectServer } from "./dialog-select-server"
import { showToast } from "@stud/ui/toast"

type ServerStatus = { healthy: boolean; version?: string }

type BridgeStatus = {
  running: boolean
  connected: boolean
  pendingRequests: number
  lastPollTime: number
}

async function checkHealth(url: string, platform: ReturnType<typeof usePlatform>): Promise<ServerStatus> {
  const signal = (AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }).timeout?.(3000)
  const sdk = createOpencodeClient({
    baseUrl: url,
    fetch: platform.fetch,
    signal,
  })
  return sdk.global
    .health()
    .then((x) => ({ healthy: x.data?.healthy === true, version: x.data?.version }))
    .catch(() => ({ healthy: false }))
}

async function checkBridgeStatus(): Promise<BridgeStatus> {
  try {
    const response = await fetch("http://localhost:3001/stud/status", {
      signal: AbortSignal.timeout(1000),
    })
    if (!response.ok) {
      return { running: false, connected: false, pendingRequests: 0, lastPollTime: 0 }
    }
    const data = await response.json()
    return {
      running: true,
      connected: data.connected === true,
      pendingRequests: data.pendingRequests ?? 0,
      lastPollTime: data.lastPollTime ?? 0,
    }
  } catch {
    return { running: false, connected: false, pendingRequests: 0, lastPollTime: 0 }
  }
}

export function StatusPopover() {
  const sync = useSync()
  const sdk = useSDK()
  const server = useServer()
  const platform = usePlatform()
  const dialog = useDialog()
  const language = useLanguage()
  const navigate = useNavigate()

  const [store, setStore] = createStore({
    status: {} as Record<string, ServerStatus | undefined>,
    loading: null as string | null,
    defaultServerUrl: undefined as string | undefined,
    bridge: { running: false, connected: false, pendingRequests: 0, lastPollTime: 0 } as BridgeStatus,
  })

  const servers = createMemo(() => {
    const current = server.url
    const list = server.list
    if (!current) return list
    if (!list.includes(current)) return [current, ...list]
    return [current, ...list.filter((x) => x !== current)]
  })

  const sortedServers = createMemo(() => {
    const list = servers()
    if (!list.length) return list
    const active = server.url
    const order = new Map(list.map((url, index) => [url, index] as const))
    const rank = (value?: ServerStatus) => {
      if (value?.healthy === true) return 0
      if (value?.healthy === false) return 2
      return 1
    }
    return list.slice().sort((a, b) => {
      if (a === active) return -1
      if (b === active) return 1
      const diff = rank(store.status[a]) - rank(store.status[b])
      if (diff !== 0) return diff
      return (order.get(a) ?? 0) - (order.get(b) ?? 0)
    })
  })

  async function refreshHealth() {
    const results: Record<string, ServerStatus> = {}
    await Promise.all(
      servers().map(async (url) => {
        results[url] = await checkHealth(url, platform)
      }),
    )
    setStore("status", reconcile(results))
  }

  async function refreshBridgeStatus() {
    const status = await checkBridgeStatus()
    setStore("bridge", status)
  }

  createEffect(() => {
    servers()
    refreshHealth()
    refreshBridgeStatus()
    const healthInterval = setInterval(refreshHealth, 10_000)
    const bridgeInterval = setInterval(refreshBridgeStatus, 2_000)
    onCleanup(() => {
      clearInterval(healthInterval)
      clearInterval(bridgeInterval)
    })
  })

  const mcpItems = createMemo(() =>
    Object.entries(sync.data.mcp ?? {})
      .map(([name, status]) => ({ name, status: status.status }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  )

  const mcpConnected = createMemo(() => mcpItems().filter((i) => i.status === "connected").length)

  const toggleMcp = async (name: string) => {
    if (store.loading) return
    setStore("loading", name)

    try {
      const status = sync.data.mcp[name]
      await (status?.status === "connected" ? sdk.client.mcp.disconnect({ name }) : sdk.client.mcp.connect({ name }))
      const result = await sdk.client.mcp.status()
      if (result.data) sync.set("mcp", result.data)
    } catch (err) {
      showToast({
        variant: "error",
        title: language.t("common.requestFailed"),
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setStore("loading", null)
    }
  }

  const lspItems = createMemo(() => sync.data.lsp ?? [])
  const lspCount = createMemo(() => lspItems().length)
  const plugins = createMemo(() => sync.data.config.plugin ?? [])
  const pluginCount = createMemo(() => plugins().length)

  const overallHealthy = createMemo(() => {
    const serverHealthy = server.healthy() === true
    const anyMcpIssue = mcpItems().some((m) => m.status !== "connected" && m.status !== "disabled")
    return serverHealthy && !anyMcpIssue
  })

  const serverCount = createMemo(() => sortedServers().length)

  const refreshDefaultServerUrl = () => {
    const result = platform.getDefaultServerUrl?.()
    if (!result) {
      setStore("defaultServerUrl", undefined)
      return
    }
    if (result instanceof Promise) {
      result.then((url) => setStore("defaultServerUrl", url ? normalizeServerUrl(url) : undefined))
      return
    }
    setStore("defaultServerUrl", normalizeServerUrl(result))
  }

  createEffect(() => {
    refreshDefaultServerUrl()
  })

  return (
    <Popover
      triggerAs={Button}
      triggerProps={{
        variant: "ghost",
        class:
          "rounded-sm w-[75px] h-[24px] py-1.5 pr-3 pl-2 gap-2 border-none shadow-none data-[expanded]:bg-surface-raised-base-active",
        style: { scale: 1 },
      }}
      trigger={
        <div class="flex items-center gap-1.5">
          <div
            classList={{
              "size-1.5 rounded-full": true,
              "bg-icon-success-base": overallHealthy(),
              "bg-icon-critical-base": !overallHealthy() && server.healthy() !== undefined,
              "bg-border-weak-base": server.healthy() === undefined,
            }}
          />
          <span class="text-12-regular text-text-strong">{language.t("status.popover.trigger")}</span>
        </div>
      }
      class="[&_[data-slot=popover-body]]:p-0 w-[360px] max-w-[calc(100vw-40px)] bg-transparent border-0 shadow-none rounded-xl"
      gutter={6}
      placement="bottom-end"
      shift={-136}
    >
      <div class="flex items-center gap-1 w-[360px] rounded-xl shadow-[var(--shadow-lg-border-base)]">
        <Tabs
          aria-label={language.t("status.popover.ariaLabel")}
          class="tabs bg-background-strong rounded-xl overflow-hidden"
          data-component="tabs"
          data-active="servers"
          defaultValue="servers"
          variant="alt"
        >
          <Tabs.List data-slot="tablist" class="bg-transparent border-b-0 px-4 pt-2 pb-0 gap-4 h-10">
            <Tabs.Trigger value="servers" data-slot="tab" class="text-12-regular">
              {serverCount() > 0 ? `${serverCount()} ` : ""}
              {language.t("status.popover.tab.servers")}
            </Tabs.Trigger>
            <Tabs.Trigger value="bridge" data-slot="tab" class="text-12-regular">
              Bridge
            </Tabs.Trigger>
            <Tabs.Trigger value="mcp" data-slot="tab" class="text-12-regular">
              {mcpConnected() > 0 ? `${mcpConnected()} ` : ""}
              {language.t("status.popover.tab.mcp")}
            </Tabs.Trigger>
            <Tabs.Trigger value="lsp" data-slot="tab" class="text-12-regular">
              {lspCount() > 0 ? `${lspCount()} ` : ""}
              {language.t("status.popover.tab.lsp")}
            </Tabs.Trigger>
            <Tabs.Trigger value="plugins" data-slot="tab" class="text-12-regular">
              {pluginCount() > 0 ? `${pluginCount()} ` : ""}
              {language.t("status.popover.tab.plugins")}
            </Tabs.Trigger>
          </Tabs.List>

          <Tabs.Content value="servers">
            <div class="flex flex-col px-2 pb-2">
              <div class="flex flex-col p-3 bg-background-base rounded-sm min-h-14">
                <For each={sortedServers()}>
                  {(url) => {
                    const isActive = () => url === server.url
                    const isDefault = () => url === store.defaultServerUrl
                    const status = () => store.status[url]
                    const isBlocked = () => status()?.healthy === false
                    const [truncated, setTruncated] = createSignal(false)
                    let nameRef: HTMLSpanElement | undefined
                    let versionRef: HTMLSpanElement | undefined

                    onMount(() => {
                      const check = () => {
                        const nameTruncated = nameRef ? nameRef.scrollWidth > nameRef.clientWidth : false
                        const versionTruncated = versionRef ? versionRef.scrollWidth > versionRef.clientWidth : false
                        setTruncated(nameTruncated || versionTruncated)
                      }
                      check()
                      window.addEventListener("resize", check)
                      onCleanup(() => window.removeEventListener("resize", check))
                    })

                    const tooltipValue = () => {
                      const name = serverDisplayName(url)
                      const version = status()?.version
                      return (
                        <span class="flex items-center gap-2">
                          <span>{name}</span>
                          <Show when={version}>
                            <span class="text-text-invert-base">{version}</span>
                          </Show>
                        </span>
                      )
                    }

                    return (
                      <Tooltip value={tooltipValue()} placement="top" inactive={!truncated()}>
                        <button
                          type="button"
                          class="flex items-center gap-2 w-full h-8 pl-3 pr-1.5 py-1.5 rounded-md transition-colors text-left"
                          classList={{
                            "opacity-50": isBlocked(),
                            "hover:bg-surface-raised-base-hover": !isBlocked(),
                            "cursor-not-allowed": isBlocked(),
                          }}
                          aria-disabled={isBlocked()}
                          onClick={() => {
                            if (isBlocked()) return
                            server.setActive(url)
                            navigate("/")
                          }}
                        >
                          <div
                            classList={{
                              "size-1.5 rounded-full shrink-0": true,
                              "bg-icon-success-base": status()?.healthy === true,
                              "bg-icon-critical-base": status()?.healthy === false,
                              "bg-border-weak-base": status() === undefined,
                            }}
                          />
                          <span ref={nameRef} class="text-14-regular text-text-base truncate">
                            {serverDisplayName(url)}
                          </span>
                          <Show when={status()?.version}>
                            <span ref={versionRef} class="text-12-regular text-text-weak truncate">
                              {status()?.version}
                            </span>
                          </Show>
                          <Show when={isDefault()}>
                            <span class="text-11-regular text-text-base bg-surface-base px-1.5 py-0.5 rounded-md">
                              {language.t("common.default")}
                            </span>
                          </Show>
                          <div class="flex-1" />
                          <Show when={isActive()}>
                            <Icon name="check" size="small" class="text-icon-weak shrink-0" />
                          </Show>
                        </button>
                      </Tooltip>
                    )
                  }}
                </For>

                <Button
                  variant="secondary"
                  class="mt-3 self-start h-8 px-3 py-1.5"
                  onClick={() => dialog.show(() => <DialogSelectServer />, refreshDefaultServerUrl)}
                >
                  {language.t("status.popover.action.manageServers")}
                </Button>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="bridge">
            <div class="flex flex-col px-2 pb-2">
              <div class="flex flex-col p-3 bg-background-base rounded-sm min-h-14 gap-3">
                <div class="flex items-center gap-2">
                  <div
                    classList={{
                      "size-2 rounded-full shrink-0": true,
                      "bg-icon-success-base": store.bridge.connected,
                      "bg-icon-warning-base": store.bridge.running && !store.bridge.connected,
                      "bg-icon-critical-base": !store.bridge.running,
                    }}
                  />
                  <span class="text-14-medium text-text-strong">Roblox Studio</span>
                  <span class="text-12-regular text-text-weak ml-auto">
                    {store.bridge.connected
                      ? "Connected"
                      : store.bridge.running
                        ? "Waiting for plugin..."
                        : "Bridge not running"}
                  </span>
                </div>

                <Show when={store.bridge.running}>
                  <div class="flex flex-col gap-1 text-12-regular text-text-weak">
                    <div class="flex justify-between">
                      <span>Bridge Server</span>
                      <span class="text-text-base">localhost:3001</span>
                    </div>
                    <Show when={store.bridge.pendingRequests > 0}>
                      <div class="flex justify-between">
                        <span>Pending Requests</span>
                        <span class="text-text-base">{store.bridge.pendingRequests}</span>
                      </div>
                    </Show>
                  </div>
                </Show>

                <Show when={!store.bridge.connected}>
                  <div class="text-12-regular text-text-weak bg-surface-base p-2 rounded-sm">
                    <Show
                      when={store.bridge.running}
                      fallback={
                        <p>
                          The bridge server is not running. Start the Stud desktop app to enable Studio integration.
                        </p>
                      }
                    >
                      <p>To connect Roblox Studio:</p>
                      <ol class="list-decimal list-inside mt-1 space-y-0.5">
                        <li>Open Roblox Studio</li>
                        <li>Enable HTTP Requests in Game Settings</li>
                        <li>Click the Stud toolbar button</li>
                      </ol>
                    </Show>
                  </div>
                </Show>

                <Show when={store.bridge.connected}>
                  <div class="text-12-regular text-text-weak bg-surface-base p-2 rounded-sm">
                    <p>Studio operations create undo waypoints.</p>
                    <p class="mt-1">
                      Use <code class="bg-surface-raised-base px-1 rounded">Ctrl+Z</code> in Studio to undo AI changes.
                    </p>
                  </div>
                </Show>

                <Button variant="secondary" class="self-start h-8 px-3 py-1.5" onClick={() => refreshBridgeStatus()}>
                  Refresh
                </Button>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="mcp">
            <div class="flex flex-col px-2 pb-2">
              <div class="flex flex-col p-3 bg-background-base rounded-sm min-h-14">
                <Show
                  when={mcpItems().length > 0}
                  fallback={
                    <div class="text-14-regular text-text-base text-center my-auto">
                      {language.t("dialog.mcp.empty")}
                    </div>
                  }
                >
                  <For each={mcpItems()}>
                    {(item) => {
                      const enabled = () => item.status === "connected"
                      return (
                        <button
                          type="button"
                          class="flex items-center gap-2 w-full h-8 pl-3 pr-2 py-1 rounded-md hover:bg-surface-raised-base-hover transition-colors text-left"
                          onClick={() => toggleMcp(item.name)}
                          disabled={store.loading === item.name}
                        >
                          <div
                            classList={{
                              "size-1.5 rounded-full shrink-0": true,
                              "bg-icon-success-base": item.status === "connected",
                              "bg-icon-critical-base": item.status === "failed",
                              "bg-border-weak-base": item.status === "disabled",
                              "bg-icon-warning-base":
                                item.status === "needs_auth" || item.status === "needs_client_registration",
                            }}
                          />
                          <span class="text-14-regular text-text-base truncate flex-1">{item.name}</span>
                          <div onClick={(event) => event.stopPropagation()}>
                            <Switch
                              checked={enabled()}
                              disabled={store.loading === item.name}
                              onChange={() => toggleMcp(item.name)}
                            />
                          </div>
                        </button>
                      )
                    }}
                  </For>
                </Show>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="lsp">
            <div class="flex flex-col px-2 pb-2">
              <div class="flex flex-col p-3 bg-background-base rounded-sm min-h-14">
                <Show
                  when={lspItems().length > 0}
                  fallback={
                    <div class="text-14-regular text-text-base text-center my-auto">
                      {language.t("dialog.lsp.empty")}
                    </div>
                  }
                >
                  <For each={lspItems()}>
                    {(item) => (
                      <div class="flex items-center gap-2 w-full px-2 py-1">
                        <div
                          classList={{
                            "size-1.5 rounded-full shrink-0": true,
                            "bg-icon-success-base": item.status === "connected",
                            "bg-icon-critical-base": item.status === "error",
                          }}
                        />
                        <span class="text-14-regular text-text-base truncate">{item.name || item.id}</span>
                      </div>
                    )}
                  </For>
                </Show>
              </div>
            </div>
          </Tabs.Content>

          <Tabs.Content value="plugins">
            <div class="flex flex-col px-2 pb-2">
              <div class="flex flex-col p-3 bg-background-base rounded-sm min-h-14">
                <Show
                  when={plugins().length > 0}
                  fallback={
                    <div class="text-14-regular text-text-base text-center my-auto">
                      {(() => {
                        const value = language.t("dialog.plugins.empty")
                        const file = "opencode.json"
                        const parts = value.split(file)
                        if (parts.length === 1) return value
                        return (
                          <>
                            {parts[0]}
                            <code class="bg-surface-raised-base px-1.5 py-0.5 rounded-sm text-text-base">{file}</code>
                            {parts.slice(1).join(file)}
                          </>
                        )
                      })()}
                    </div>
                  }
                >
                  <For each={plugins()}>
                    {(plugin) => (
                      <div class="flex items-center gap-2 w-full px-2 py-1">
                        <div class="size-1.5 rounded-full shrink-0 bg-icon-success-base" />
                        <span class="text-14-regular text-text-base truncate">{plugin}</span>
                      </div>
                    )}
                  </For>
                </Show>
              </div>
            </div>
          </Tabs.Content>
        </Tabs>
      </div>
    </Popover>
  )
}
