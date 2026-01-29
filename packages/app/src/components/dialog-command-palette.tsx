import { Dialog } from "@stud/ui/dialog"
import { List } from "@stud/ui/list"
import { Icon } from "@stud/ui/icon"
import { Keybind } from "@stud/ui/keybind"
import { createMemo, Show } from "solid-js"
import { useCommand, type CommandOption } from "@/context/command"
import { useDialog } from "@stud/ui/context/dialog"
import { useLanguage } from "@/context/language"

type Entry = {
  id: string
  title: string
  description?: string
  category?: string
  keybind?: string
  option: CommandOption
}

export function DialogCommandPalette() {
  const command = useCommand()
  const dialog = useDialog()
  const language = useLanguage()

  const entries = createMemo<Entry[]>(() => {
    return command.options
      .filter((item) => !item.disabled)
      .map((item) => ({
        id: item.id,
        title: item.title,
        description: item.description,
        category: item.category ?? language.t("palette.group.commands"),
        keybind: (() => {
          const key = command.keybind(item.id)
          if (!key) return undefined
          return key
        })(),
        option: item,
      }))
  })

  const select = (item: Entry | undefined) => {
    if (!item) return
    dialog.close()
    item.option.onSelect?.("palette")
  }

  return (
    <Dialog title={language.t("command.palette")} class="w-[560px] max-w-[90vw]" fit transition>
      <div class="px-4 pb-4">
        <List
          items={entries()}
          key={(item) => item.id}
          groupBy={(item) => item.category ?? ""}
          filterKeys={["title", "description", "category"]}
          onSelect={select}
          search={{ placeholder: "Search commands…", autofocus: true }}
          divider
        >
          {(item) => (
            <div class="flex items-center gap-3 min-w-0">
              <div class="size-8 rounded-md border border-border-weak-base bg-surface-base flex items-center justify-center">
                <Icon name="dot-grid" size="small" />
              </div>
              <div class="flex flex-col gap-1 min-w-0 flex-1">
                <span class="text-13-medium text-text-strong truncate">{item.title}</span>
                <span class="text-12-regular text-text-weak truncate">{item.description}</span>
              </div>
              <Show when={item.keybind}>
                {(key) => (
                  <div class="shrink-0">
                    <Keybind>{key()}</Keybind>
                  </div>
                )}
              </Show>
            </div>
          )}
        </List>
      </div>
    </Dialog>
  )
}
