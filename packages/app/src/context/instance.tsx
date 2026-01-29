import { createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { createSimpleContext } from "@stud/ui/context/helper"
import { studioRequest } from "@/utils/studio"

export type InstanceSelection = {
  path: string
  name: string
  className: string
}

export const { use: useInstance, provider: InstanceProvider } = createSimpleContext({
  name: "Instance",
  init: () => {
    const [store, setStore] = createStore({
      selected: null as InstanceSelection | null,
    })

    const setSelected = (next: InstanceSelection | null) => {
      const current = store.selected
      if (!next && !current) return
      if (next && current && next.path === current.path) return
      setStore("selected", next)
    }

    createEffect(() => {
      const poll = () => {
        studioRequest<InstanceSelection[]>("/selection/get").then((result) => {
          if (!result.success) return
          const first = result.data[0] ?? null
          setSelected(first)
        })
      }

      poll()
      const interval = setInterval(poll, 2000)
      onCleanup(() => clearInterval(interval))
    })

    return {
      selected() {
        return store.selected
      },
      setSelected,
      clear() {
        setStore("selected", null)
      },
    }
  },
})
