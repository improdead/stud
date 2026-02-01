import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { Icon } from "@stud/ui/icon"
import { IconButton } from "@stud/ui/icon-button"
import { InstanceIcon } from "@stud/ui/instance-icon"
import { Collapsible } from "@stud/ui/collapsible"
import { useCodeComponent } from "@stud/ui/context/code"
import { usePrompt } from "@/context/prompt"
import { useInstance } from "@/context/instance"
import { useFile } from "@/context/file"
import { studioRequest } from "@/utils/studio"

const SCRIPT_CLASSES = ["Script", "LocalScript", "ModuleScript"]

function isScript(className: string) {
  return SCRIPT_CLASSES.includes(className)
}

interface PropertyInfo {
  name: string
  value: string
  type: string
}

// Property categories for grouping
const PROPERTY_CATEGORIES: Record<string, string[]> = {
  Transform: ["Position", "Rotation", "Size", "CFrame", "Orientation", "Origin"],
  Appearance: ["Color", "Color3", "Material", "Transparency", "Reflectance", "BrickColor", "TextureID"],
  Behavior: ["Anchored", "CanCollide", "CanTouch", "Massless", "CanQuery"],
  Data: ["Name", "Parent", "ClassName", "Archivable"],
}

function getPropertyIcon(type: string): string {
  switch (type.toLowerCase()) {
    case "string":
      return "text"
    case "number":
    case "float":
    case "int":
      return "hash"
    case "boolean":
    case "bool":
      return "toggle-left"
    case "vector3":
    case "vector2":
      return "box"
    case "color3":
    case "brickcolor":
      return "palette"
    case "cframe":
      return "move"
    case "enum":
      return "list"
    default:
      return "circle"
  }
}

function categorizeProperties(properties: PropertyInfo[]): Record<string, PropertyInfo[]> {
  const categorized: Record<string, PropertyInfo[]> = {}
  const used = new Set<string>()

  for (const [category, names] of Object.entries(PROPERTY_CATEGORIES)) {
    const matched = properties.filter((p) => names.includes(p.name))
    if (matched.length > 0) {
      categorized[category] = matched
      for (const m of matched) used.add(m.name)
    }
  }

  const other = properties.filter((p) => !used.has(p.name))
  if (other.length > 0) {
    categorized["Other"] = other
  }

  return categorized
}

function PropertyRow(props: { prop: PropertyInfo }) {
  const isColor = () => props.prop.type === "Color3" || props.prop.type === "BrickColor"

  return (
    <div class="flex items-center gap-2 py-1.5 px-2 rounded hover:bg-surface-base-hover group transition-colors">
      <Icon name={getPropertyIcon(props.prop.type)} size="small" class="text-icon-subtle shrink-0" />
      <span class="text-12-regular text-text-base flex-1 truncate">{props.prop.name}</span>
      <Show when={isColor()}>
        <div
          class="size-4 rounded border border-border-base shrink-0"
          style={{ "background-color": props.prop.value }}
        />
      </Show>
      <span class="text-12-regular text-text-strong truncate max-w-[100px]" title={props.prop.value}>
        {props.prop.value}
      </span>
      <span class="text-10-regular text-text-subtle bg-surface-base px-1.5 py-0.5 rounded">{props.prop.type}</span>
    </div>
  )
}

function InstanceProperties(props: { path: string }) {
  const [properties] = createResource(
    () => props.path,
    async (path) => {
      const result = await studioRequest<PropertyInfo[]>("/instance/properties", { path })
      if (result.success) return result.data
      return []
    },
  )

  const categorized = createMemo(() => categorizeProperties(properties() ?? []))
  const categoryOrder = ["Data", "Transform", "Appearance", "Behavior", "Other"]

  return (
    <div class="flex flex-col">
      <Show
        when={!properties.loading}
        fallback={
          <div class="flex items-center gap-2 px-4 py-3 text-12-regular text-text-weak">
            <div class="size-4 border-2 border-border-base border-t-text-subtle rounded-full animate-spin" />
            Loading properties...
          </div>
        }
      >
        <Show
          when={properties()?.length}
          fallback={
            <div class="px-4 py-3 text-12-regular text-text-weak flex items-center gap-2">
              <Icon name="info" size="small" class="text-icon-subtle" />
              No properties available
            </div>
          }
        >
          <For each={categoryOrder.filter((cat) => categorized()[cat]?.length)}>
            {(category) => (
              <Collapsible defaultOpen={category !== "Other"} class="border-b border-border-weak-base last:border-b-0">
                <Collapsible.Trigger class="w-full">
                  <div class="flex items-center gap-2 py-2 px-4 hover:bg-surface-base-hover transition-colors">
                    <Icon
                      name="chevron-right"
                      size="small"
                      class="text-icon-subtle transition-transform duration-200 group-data-[state=open]:rotate-90"
                    />
                    <span class="text-11-medium text-text-subtle uppercase tracking-wider">{category}</span>
                    <span class="text-10-regular text-text-weak ml-auto bg-surface-base px-1.5 py-0.5 rounded-full">
                      {categorized()[category]?.length}
                    </span>
                  </div>
                </Collapsible.Trigger>
                <Collapsible.Content>
                  <div class="flex flex-col px-2 pb-2">
                    <For each={categorized()[category]}>{(prop) => <PropertyRow prop={prop} />}</For>
                  </div>
                </Collapsible.Content>
              </Collapsible>
            )}
          </For>
        </Show>
      </Show>
    </div>
  )
}

function ScriptPreview(props: {
  filePath?: string
  path?: string
  name: string
  className: string
  onClose?: () => void
}) {
  const file = useFile()
  const instance = useInstance()
  const codeComponent = useCodeComponent()
  const [cacheKey, setCacheKey] = createSignal(0)
  const [studioSource, setStudioSource] = createSignal<string | null>(null)
  const [loading, setLoading] = createSignal(false)

  // Load from file if filePath exists
  createEffect(() => {
    if (props.filePath) {
      file.load(props.filePath)
    }
  })

  // Load from Studio if no filePath but has path
  createEffect(() => {
    if (!props.filePath && props.path) {
      setLoading(true)
      studioRequest<{ source: string }>("/script/get", { path: props.path })
        .then((result) => {
          if (result.success) {
            setStudioSource(result.data.source)
          }
        })
        .finally(() => setLoading(false))
    }
  })

  const fileState = createMemo(() => (props.filePath ? file.get(props.filePath) : null))
  const contents = createMemo(() => {
    // Prefer file content if available
    const state = fileState()
    if (state?.content?.type === "text") return state.content.content
    // Fall back to studio source
    return studioSource() ?? ""
  })

  const isLoading = createMemo(() => {
    if (props.filePath) return fileState()?.loading ?? false
    return loading()
  })

  const lineCount = createMemo(() => {
    const c = contents()
    if (!c) return 0
    return c.split("\n").length
  })

  createEffect(() => {
    contents()
    setCacheKey((k) => k + 1)
  })

  return (
    <div class="flex flex-col h-full overflow-hidden">
      {/* Header with close button */}
      <div class="flex items-center gap-3 px-4 py-3 border-b border-border-base bg-surface-base/50">
        <div class="size-9 rounded-lg bg-surface-raised-base flex items-center justify-center">
          <InstanceIcon className={props.className} class="size-5" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-13-medium text-text-strong truncate">{props.name}</div>
          <div class="flex items-center gap-2 mt-0.5">
            <span class="text-10-regular text-text-subtle bg-surface-base px-1.5 py-0.5 rounded">
              {props.className}
            </span>
            <Show when={lineCount() > 0}>
              <span class="text-10-regular text-text-weak">{lineCount()} lines</span>
            </Show>
          </div>
        </div>
        <IconButton
          icon="close"
          variant="ghost"
          class="text-icon-subtle hover:text-icon-base shrink-0"
          onClick={() => instance.clearInspected()}
          aria-label="Close inspector"
        />
      </div>
      <div class="flex-1 min-h-0 overflow-auto">
        <Show
          when={!isLoading() && contents()}
          fallback={
            <div class="px-4 py-3 text-12-regular text-text-weak flex items-center gap-2">
              <Show when={isLoading()}>
                <div class="size-4 border-2 border-border-base border-t-text-subtle rounded-full animate-spin" />
              </Show>
              {isLoading() ? "Loading..." : "No content"}
            </div>
          }
        >
          <Dynamic
            component={codeComponent}
            file={{
              name: props.filePath ?? `${props.name}.lua`,
              contents: contents(),
              cacheKey: `script-preview-${cacheKey()}`,
            }}
            overflow="scroll"
            class="select-text"
          />
        </Show>
      </div>
    </div>
  )
}

function InstanceInspector() {
  const prompt = usePrompt()
  const instance = useInstance()
  const selection = createMemo(() => instance.inspected())

  const setPrompt = (text: string) => {
    prompt.set([{ type: "text", content: text, start: 0, end: text.length }], text.length)
  }

  const addScript = () => {
    const target = selection()?.path ?? "the selected instance"
    setPrompt(`Add a script to ${target} that handles its behavior.`)
  }

  const insertModel = () => {
    const target = selection()?.path ?? "game.Workspace"
    setPrompt(`Search the toolbox and insert a model into ${target}.`)
  }

  const editProps = () => {
    const target = selection()?.path ?? "the selected instance"
    setPrompt(`Update properties on ${target}.`)
  }

  const pathSegments = createMemo(() => {
    const path = selection()?.path
    if (!path) return []
    return path.split(".")
  })

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <Show
        when={selection()}
        fallback={
          <div class="flex-1 flex flex-col items-center justify-center gap-3 px-6 py-8 text-center">
            <div class="size-12 rounded-full bg-surface-base flex items-center justify-center">
              <Icon name="sliders" class="text-icon-subtle" />
            </div>
            <div class="text-13-regular text-text-weak max-w-48">
              Double-click an instance in the Explorer to inspect it
            </div>
          </div>
        }
      >
        {(item) => (
          <>
            {/* Header Section */}
            <div class="flex flex-col gap-3 px-4 py-3 border-b border-border-base bg-surface-base/50">
              {/* Icon + Name + Close */}
              <div class="flex items-center gap-3">
                <div class="size-10 rounded-lg bg-surface-raised-base flex items-center justify-center shadow-sm">
                  <InstanceIcon className={item().className} class="size-6" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-14-medium text-text-strong truncate">{item().name}</div>
                  <span class="text-10-regular text-text-subtle bg-surface-base px-1.5 py-0.5 rounded mt-0.5 inline-block">
                    {item().className}
                  </span>
                </div>
                <IconButton
                  icon="close"
                  variant="ghost"
                  class="text-icon-subtle hover:text-icon-base shrink-0"
                  onClick={() => instance.clearInspected()}
                  aria-label="Close inspector"
                />
              </div>

              {/* Breadcrumb Path */}
              <div class="flex items-center gap-0.5 text-11-regular text-text-subtle overflow-x-auto scrollbar-none">
                <For each={pathSegments()}>
                  {(segment, index) => (
                    <>
                      <Show when={index() > 0}>
                        <Icon name="chevron-right" size="small" class="text-icon-weak shrink-0 mx-0.5" />
                      </Show>
                      <span class="hover:text-text-base cursor-pointer truncate max-w-24 transition-colors">
                        {segment}
                      </span>
                    </>
                  )}
                </For>
              </div>
            </div>

            {/* Quick Actions */}
            <div class="px-4 py-3 border-b border-border-weak-base">
              <div class="text-11-medium text-text-subtle uppercase tracking-wider mb-2">Quick Actions</div>
              <div class="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={addScript}
                  class="flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg bg-surface-base hover:bg-surface-base-hover active:scale-95 transition-all group"
                >
                  <Icon name="file-code" class="text-icon-subtle group-hover:text-icon-base transition-colors" />
                  <span class="text-11-medium text-text-weak group-hover:text-text-base transition-colors">
                    Add Script
                  </span>
                </button>
                <button
                  type="button"
                  onClick={insertModel}
                  class="flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg bg-surface-base hover:bg-surface-base-hover active:scale-95 transition-all group"
                >
                  <Icon name="box" class="text-icon-subtle group-hover:text-icon-base transition-colors" />
                  <span class="text-11-medium text-text-weak group-hover:text-text-base transition-colors">
                    Insert Model
                  </span>
                </button>
                <button
                  type="button"
                  onClick={editProps}
                  class="flex flex-col items-center gap-1.5 py-3 px-2 rounded-lg bg-surface-base hover:bg-surface-base-hover active:scale-95 transition-all group"
                >
                  <Icon name="settings" class="text-icon-subtle group-hover:text-icon-base transition-colors" />
                  <span class="text-11-medium text-text-weak group-hover:text-text-base transition-colors">
                    Edit Props
                  </span>
                </button>
              </div>
            </div>

            {/* Properties */}
            <div class="flex-1 min-h-0 overflow-auto">
              <div class="py-2">
                <div class="text-11-medium text-text-subtle uppercase tracking-wider px-4 mb-2">Properties</div>
                <InstanceProperties path={item().path} />
              </div>
            </div>
          </>
        )}
      </Show>
    </div>
  )
}

export function SessionInspectorTab() {
  const instance = useInstance()
  const selection = createMemo(() => instance.inspected())

  const scriptSelection = createMemo(() => {
    const sel = selection()
    if (!sel) return null
    if (!isScript(sel.className)) return null
    return sel
  })

  return (
    <Show when={scriptSelection()} fallback={<InstanceInspector />}>
      {(script) => (
        <ScriptPreview
          filePath={script().filePath}
          path={script().path}
          name={script().name}
          className={script().className}
        />
      )}
    </Show>
  )
}
