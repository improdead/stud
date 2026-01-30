import { createEffect, createMemo, createResource, createSignal, For, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { Button } from "@stud/ui/button"
import { InstanceIcon } from "@stud/ui/instance-icon"
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

function ScriptPreview(props: { filePath?: string; path?: string; name: string; className: string }) {
  const file = useFile()
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

  createEffect(() => {
    contents()
    setCacheKey((k) => k + 1)
  })

  return (
    <div class="flex flex-col h-full overflow-hidden">
      <div class="flex items-center gap-2 px-4 py-2 border-b border-border-base">
        <InstanceIcon className={props.className} class="size-4 shrink-0" />
        <span class="text-13-medium text-text-strong truncate">{props.name}</span>
        <span class="text-11-regular text-text-subtle ml-auto">{props.className}</span>
      </div>
      <div class="flex-1 min-h-0 overflow-auto">
        <Show
          when={!isLoading() && contents()}
          fallback={
            <div class="px-4 py-3 text-12-regular text-text-weak">
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

function InstanceProperties(props: { path: string }) {
  const [properties] = createResource(
    () => props.path,
    async (path) => {
      const result = await studioRequest<PropertyInfo[]>("/instance/properties", { path })
      if (result.success) return result.data
      return []
    },
  )

  return (
    <div class="flex flex-col gap-1">
      <div class="text-12-medium text-text-subtle pb-1">Properties</div>
      <Show
        when={!properties.loading}
        fallback={<div class="text-12-regular text-text-weak">Loading...</div>}
      >
        <Show when={properties()?.length} fallback={<div class="text-12-regular text-text-weak">No properties available</div>}>
          <div class="flex flex-col gap-0.5">
            <For each={properties()}>
              {(prop) => (
                <div class="flex items-center gap-2 py-1 px-2 rounded hover:bg-fill-ghost-hover">
                  <span class="text-12-regular text-text-base flex-1 truncate">{prop.name}</span>
                  <span class="text-12-regular text-text-strong truncate max-w-[120px]" title={prop.value}>
                    {prop.value}
                  </span>
                  <span class="text-11-regular text-text-subtle">{prop.type}</span>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>
    </div>
  )
}

function InstanceInspector() {
  const prompt = usePrompt()
  const instance = useInstance()
  const selection = createMemo(() => instance.selected())

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

  return (
    <div class="flex flex-col gap-4 px-4 py-3 overflow-auto h-full">
      <Show
        when={selection()}
        fallback={<div class="text-13-regular text-text-weak">Select an instance to inspect.</div>}
      >
        {(item) => (
          <>
            <div class="flex flex-col gap-1">
              <div class="flex items-center gap-2">
                <InstanceIcon className={item().className} class="size-5 shrink-0" />
                <div class="text-14-medium text-text-strong truncate">{item().name}</div>
              </div>
              <div class="text-12-regular text-text-subtle truncate">{item().className}</div>
              <div class="text-11-regular text-text-weak truncate">{item().path}</div>
            </div>

            <div class="flex flex-col gap-2">
              <div class="text-12-medium text-text-subtle">Quick Actions</div>
              <div class="flex flex-wrap gap-2">
                <Button variant="ghost" size="small" onClick={addScript}>
                  Add Script
                </Button>
                <Button variant="ghost" size="small" onClick={insertModel}>
                  Insert Model
                </Button>
                <Button variant="ghost" size="small" onClick={editProps}>
                  Edit Properties
                </Button>
              </div>
            </div>

            <InstanceProperties path={item().path} />
          </>
        )}
      </Show>
    </div>
  )
}

export function SessionInspectorTab() {
  const instance = useInstance()
  const selection = createMemo(() => instance.selected())

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
