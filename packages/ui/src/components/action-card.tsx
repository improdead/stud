import { type ComponentProps, createSignal, Show, type JSX } from "solid-js"
import { Collapsible } from "./collapsible"
import { Icon, type IconProps } from "./icon"

export interface ActionCardProps {
  icon: IconProps["name"]
  title: string
  subtitle?: string
  status?: "success" | "pending" | "error" | "info"
  meta?: JSX.Element
  actions?: JSX.Element
  children?: JSX.Element
  defaultOpen?: boolean
  hideDetails?: boolean
  class?: ComponentProps<"div">["class"]
  classList?: ComponentProps<"div">["classList"]
}

export function ActionCard(props: ActionCardProps) {
  const [open, setOpen] = createSignal(props.defaultOpen ?? false)
  const hasDetails = () => !!props.children && !props.hideDetails

  const handleOpenChange = (value: boolean) => {
    if (!hasDetails()) return
    setOpen(value)
  }

  return (
    <Collapsible
      open={open()}
      onOpenChange={handleOpenChange}
      variant="ghost"
      classList={props.classList}
      class={props.class}
    >
      <div data-component="action-card" data-status={props.status || "info"} data-open={open() ? "true" : undefined}>
        <Collapsible.Trigger disabled={!hasDetails()}>
          <div data-slot="action-card-header">
            <div data-slot="action-card-icon">
              <Icon name={props.icon} size="small" />
            </div>
            <div data-slot="action-card-title">
              <span data-slot="action-card-title-text">{props.title}</span>
              <Show when={props.subtitle}>
                <span data-slot="action-card-subtitle">{props.subtitle}</span>
              </Show>
            </div>
            <Show when={props.meta}>
              <div data-slot="action-card-meta">{props.meta}</div>
            </Show>
            <Show when={props.actions}>
              <div
                data-slot="action-card-actions"
                onClick={(event) => {
                  event.stopPropagation()
                }}
              >
                {props.actions}
              </div>
            </Show>
            <Show when={hasDetails()}>
              <Collapsible.Arrow />
            </Show>
          </div>
        </Collapsible.Trigger>
        <Show when={hasDetails()}>
          <Collapsible.Content>
            <div data-slot="action-card-body">{props.children}</div>
          </Collapsible.Content>
        </Show>
      </div>
    </Collapsible>
  )
}
