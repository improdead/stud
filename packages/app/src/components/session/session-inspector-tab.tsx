import { createEffect, createMemo, createSignal, Show } from "solid-js"
import { Dynamic } from "solid-js/web"
import { Button } from "@stud/ui/button"
import { InlineInput } from "@stud/ui/inline-input"
import { InstanceIcon } from "@stud/ui/instance-icon"
import { useCodeComponent } from "@stud/ui/context/code"
import { usePrompt } from "@/context/prompt"
import { useInstance } from "@/context/instance"
import { useFile } from "@/context/file"

const SCRIPT_CLASSES = ["Script", "LocalScript", "ModuleScript"]

function isScript(className: string) {
  return SCRIPT_CLASSES.includes(className)
}

function ScriptPreview(props: { filePath: string; name: string; className: string }) {
  const file = useFile()
  const codeComponent = useCodeComponent()
  const [cacheKey, setCacheKey] = createSignal(0)

  createEffect(() => {
    file.load(props.filePath)
  })

  const fileState = createMemo(() => file.get(props.filePath))
  const contents = createMemo(() => {
    const state = fileState()
    if (!state?.content) return ""
    if (state.content.type === "text") return state.content.content
    return ""
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
      </div>
      <div class="flex-1 min-h-0 overflow-auto">
        <Show
          when={!fileState()?.loading && contents()}
          fallback={
            <div class="px-4 py-3 text-12-regular text-text-weak">
              {fileState()?.loading ? "Loading..." : "No content"}
            </div>
          }
        >
          <Dynamic
            component={codeComponent}
            file={{
              name: props.filePath,
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
  const selection = createMemo(() => instance.selected())

  const [name, setName] = createSignal("")
  const [color, setColor] = createSignal("")
  const [size, setSize] = createSignal("")

  const setPrompt = (text: string) => {
    prompt.set([{ type: "text", content: text, start: 0, end: text.length }], text.length)
  }

  const applyRename = () => {
    const target = selection()?.path
    const next = name().trim()
    if (!target || !next) return
    setPrompt(`Rename ${target} to ${next}.`)
  }

  const applyColor = () => {
    const target = selection()?.path
    const next = color().trim()
    if (!target || !next) return
    setPrompt(`Set ${target} Color to ${next}.`)
  }

  const applySize = () => {
    const target = selection()?.path
    const next = size().trim()
    if (!target || !next) return
    setPrompt(`Set ${target} Size to ${next}.`)
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
    setPrompt(`Update properties on ${target} (color, size, material).`)
  }

  return (
    <div class="flex flex-col gap-4 px-4 py-3">
      <Show
        when={selection()}
        fallback={<div class="text-13-regular text-text-weak">Select an instance to inspect.</div>}
      >
        {(item) => (
          <>
            <div class="flex flex-col gap-1">
              <div class="text-12-regular text-text-weak">Selected</div>
              <div class="text-14-medium text-text-strong truncate">{item().name}</div>
              <div class="text-12-regular text-text-weak truncate">{item().className}</div>
              <div class="text-12-regular text-text-weak truncate">{item().path}</div>
            </div>

            <div class="flex flex-col gap-3">
              <div class="text-12-medium text-text-subtle">Quick Actions</div>
              <div class="flex flex-wrap gap-2">
                <Button variant="ghost" size="small" onClick={addScript}>
                  Add Script
                </Button>
                <Button variant="ghost" size="small" onClick={insertModel}>
                  Insert Model
                </Button>
                <Button variant="ghost" size="small" onClick={editProps}>
                  Properties
                </Button>
              </div>
            </div>

            <div class="flex flex-col gap-3">
              <div class="text-12-medium text-text-subtle">Quick Edits</div>
              <div class="flex flex-col gap-2">
                <label class="text-12-regular text-text-weak">Rename</label>
                <div class="flex items-center gap-2">
                  <InlineInput
                    value={name()}
                    placeholder="New name"
                    onInput={(event) => setName(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return
                      applyRename()
                    }}
                    class="w-full"
                  />
                  <Button variant="secondary" size="small" onClick={applyRename}>
                    Apply
                  </Button>
                </div>

                <label class="text-12-regular text-text-weak">Color (RGB or hex)</label>
                <div class="flex items-center gap-2">
                  <InlineInput
                    value={color()}
                    placeholder="#FF8800 or 255,128,0"
                    onInput={(event) => setColor(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return
                      applyColor()
                    }}
                    class="w-full"
                  />
                  <Button variant="secondary" size="small" onClick={applyColor}>
                    Apply
                  </Button>
                </div>

                <label class="text-12-regular text-text-weak">Size (Vector3)</label>
                <div class="flex items-center gap-2">
                  <InlineInput
                    value={size()}
                    placeholder="4, 2, 1"
                    onInput={(event) => setSize(event.currentTarget.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return
                      applySize()
                    }}
                    class="w-full"
                  />
                  <Button variant="secondary" size="small" onClick={applySize}>
                    Apply
                  </Button>
                </div>
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
  const selection = createMemo(() => instance.selected())

  const scriptSelection = createMemo(() => {
    const sel = selection()
    if (!sel) return null
    if (!sel.filePath) return null
    if (!isScript(sel.className)) return null
    return sel
  })

  return (
    <Show when={scriptSelection()} fallback={<InstanceInspector />}>
      {(script) => <ScriptPreview filePath={script().filePath!} name={script().name} className={script().className} />}
    </Show>
  )
}
