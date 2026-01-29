import { type ComponentProps, createSignal, Show, type JSX, children as resolveChildren } from "solid-js"
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
  const resolved = resolveChildren(() => props.children)
  const hasDetails = () => {
    const c = resolved()
    if (props.hideDetails) return false
    if (Array.isArray(c)) return c.length > 0
    return !!c
  }

  const toggleOpen = (e: MouseEvent) => {
    e.stopPropagation()
    if (!hasDetails()) return
    setOpen(!open())
  }

  const handleHeaderClick = (e: MouseEvent) => {
    // Don't toggle if clicking on actions
    const target = e.target as HTMLElement
    if (target.closest("[data-slot='action-card-actions']")) return
    if (!hasDetails()) return
    setOpen(!open())
  }

  return (
    <div
      data-component="action-card"
      data-status={props.status || "info"}
      data-open={open() ? "true" : undefined}
      class={props.class}
      classList={props.classList}
    >
      <div data-slot="action-card-header" onClick={handleHeaderClick}>
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
          <div data-slot="action-card-actions" onClick={(e) => e.stopPropagation()}>
            {props.actions}
          </div>
        </Show>
        <Show when={hasDetails()}>
          <button
            type="button"
            data-slot="collapsible-arrow"
            onClick={toggleOpen}
            aria-expanded={open()}
            aria-label={open() ? "Collapse" : "Expand"}
          >
            <Icon name="chevron-grabber-vertical" size="small" />
          </button>
        </Show>
      </div>
      <Show when={hasDetails() && open()}>
        <div data-slot="action-card-body">{resolved()}</div>
      </Show>
    </div>
  )
}
