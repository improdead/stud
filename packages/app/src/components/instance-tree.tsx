import { Collapsible } from "@stud/ui/collapsible"
import { InstanceIcon } from "@stud/ui/instance-icon"
import { Icon } from "@stud/ui/icon"
import { Tooltip } from "@stud/ui/tooltip"
import {
  createEffect,
  createMemo,
  createResource,
  createSignal,
  For,
  Match,
  Show,
  Switch,
  type ParentProps,
} from "solid-js"
import { createStore } from "solid-js/store"
import { useServer } from "@/context/server"
import { useInstance } from "@/context/instance"
import { studioRequest } from "@/utils/studio"
import { usePlatform } from "@/context/platform"
import { base64Encode } from "@stud/util/encode"

export interface InstanceNode {
  name: string
  className: string
  path: string
  filePath?: string
  children?: InstanceNode[]
}

interface InstanceTreeProps {
  directory: string
  class?: string
  onFileClick?: (filePath: string) => void
}

async function fetchInstanceTree(
  url: string,
  directory: string,
  customFetch: typeof fetch,
): Promise<{ tree: InstanceNode | null; projectFile: string | null }> {
  const response = await customFetch(`${url}/instance-tree/tree`, {
    headers: {
      "x-stud-directory": encodeURIComponent(directory),
    },
  })
  if (!response.ok) return { tree: null, projectFile: null }
  return response.json()
}

export function InstanceTree(props: InstanceTreeProps) {
  const server = useServer()
  const platform = usePlatform()

  const [data] = createResource(
    () => ({ url: server.url, directory: props.directory }),
    (source) => fetchInstanceTree(source.url, source.directory, platform.fetch ?? fetch),
  )

  return (
    <div class={`flex flex-col ${props.class ?? ""}`}>
      <Show when={data.loading}>
        <div class="px-2 py-1.5 text-12-regular text-text-subtle">Loading...</div>
      </Show>
      <Show when={data.error}>
        <div class="px-2 py-1.5 text-12-regular text-text-subtle">Failed to load</div>
      </Show>
      <Show when={data()?.tree}>
        {(tree) => <InstanceTreeNode node={tree()} level={0} onFileClick={props.onFileClick} />}
      </Show>
      <Show when={!data.loading && !data.error && !data()?.tree}>
        <div class="px-2 py-1.5 text-12-regular text-text-subtle opacity-60">No Rojo project found</div>
      </Show>
    </div>
  )
}

interface InstanceTreeNodeProps {
  node: InstanceNode
  level: number
  onFileClick?: (filePath: string) => void
}

function InstanceTreeNode(props: InstanceTreeNodeProps) {
  const instance = useInstance()
  const [expanded, setExpanded] = createSignal(props.level < 2)
  const hasChildren = () => props.node.children && props.node.children.length > 0
  const isClickable = () => !!props.node.filePath
  const isSelected = () => instance.selected()?.path === props.node.path

  const handleClick = () => {
    instance.setSelected({
      path: props.node.path,
      name: props.node.name,
      className: props.node.className,
      filePath: props.node.filePath,
    })
    studioRequest("/selection/set", { paths: [props.node.path] })
    if (props.node.filePath && props.onFileClick) {
      props.onFileClick(props.node.filePath)
    }
  }

  const paddingLeft = () => `${Math.max(0, 4 + props.level * 12)}px`

  return (
    <div class="flex flex-col">
      <Show
        when={hasChildren()}
        fallback={
          <button
            type="button"
            class="w-full min-w-0 h-6 flex items-center justify-start gap-x-1.5 rounded-md px-1.5 py-0 text-left hover:bg-surface-raised-base-hover active:bg-surface-base-active transition-colors cursor-pointer"
            style={{ "padding-left": paddingLeft() }}
            onClick={handleClick}
            disabled={!isClickable()}
            classList={{ "bg-surface-raised-base": isSelected() }}
          >
            <div class="size-4 flex items-center justify-center" />
            <InstanceIcon className={props.node.className} class="size-4 shrink-0" />
            <span class="flex-1 min-w-0 text-12-medium text-text-weak whitespace-nowrap truncate">
              {props.node.name}
            </span>
          </button>
        }
      >
        <Collapsible variant="ghost" class="w-full" forceMount={false} open={expanded()} onOpenChange={setExpanded}>
          <Collapsible.Trigger>
            <button
              type="button"
              class="w-full min-w-0 h-6 flex items-center justify-start gap-x-1.5 rounded-md px-1.5 py-0 text-left hover:bg-surface-raised-base-hover active:bg-surface-base-active transition-colors cursor-pointer"
              style={{ "padding-left": paddingLeft() }}
              onClick={handleClick}
              classList={{ "bg-surface-raised-base": isSelected() }}
            >
              <div class="size-4 flex items-center justify-center text-icon-weak">
                <Icon name={expanded() ? "chevron-down" : "chevron-right"} size="small" />
              </div>
              <InstanceIcon className={props.node.className} class="size-4 shrink-0" />
              <span class="flex-1 min-w-0 text-12-medium text-text-weak whitespace-nowrap truncate">
                {props.node.name}
              </span>
            </button>
          </Collapsible.Trigger>
          <Collapsible.Content class="relative">
            <div
              class="absolute top-0 bottom-0 w-px pointer-events-none bg-border-weak-base opacity-30"
              style={{ left: `${Math.max(0, 4 + props.level * 12) + 8}px` }}
            />
            <For each={props.node.children}>
              {(child) => <InstanceTreeNode node={child} level={props.level + 1} onFileClick={props.onFileClick} />}
            </For>
          </Collapsible.Content>
        </Collapsible>
      </Show>
    </div>
  )
}
