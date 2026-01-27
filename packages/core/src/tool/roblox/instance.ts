import z from "zod"
import { Tool } from "../tool"
import { studioRequest, isStudioConnected, notConnectedError } from "./client"

interface InstanceInfo {
  path: string
  name: string
  className: string
  children?: InstanceInfo[]
}

interface PropertyInfo {
  name: string
  value: string
  type: string
}

export const RobloxGetChildrenTool = Tool.define<
  z.ZodObject<{
    path: z.ZodString
    recursive: z.ZodOptional<z.ZodBoolean>
  }>,
  { path: string }
>("roblox_get_children", {
  description: `List the children of an instance in Roblox Studio.

Use this to explore the game hierarchy.
Set recursive=true to get all descendants (can be slow for large trees).

Examples:
- game.Workspace
- game.ServerScriptService
- game.Players.Player1.Backpack`,
  parameters: z.object({
    path: z.string().describe("Full instance path (e.g. game.Workspace)"),
    recursive: z.boolean().optional().describe("If true, get all descendants recursively"),
  }),
  async execute(params) {
    if (!(await isStudioConnected())) {
      return { title: "Not connected", output: notConnectedError(), metadata: { path: params.path } }
    }

    const result = await studioRequest<InstanceInfo[]>("/instance/children", {
      path: params.path,
      recursive: params.recursive ?? false,
    })

    if (!result.success) {
      return { title: params.path, output: `Error: ${result.error}`, metadata: { path: params.path } }
    }

    const format = (items: InstanceInfo[], indent = 0): string => {
      return items
        .map((item) => {
          const prefix = "  ".repeat(indent)
          const line = `${prefix}- ${item.name} (${item.className})`
          if (item.children && item.children.length > 0) {
            return `${line}\n${format(item.children, indent + 1)}`
          }
          return line
        })
        .join("\n")
    }

    return {
      title: params.path,
      output: `Children of ${params.path}:\n\n${format(result.data)}`,
      metadata: { path: params.path },
    }
  },
})

export const RobloxGetPropertiesTool = Tool.define<
  z.ZodObject<{
    path: z.ZodString
  }>,
  { path: string }
>("roblox_get_properties", {
  description: `Get all properties of an instance in Roblox Studio.

Returns a list of property names, values, and types.
Useful for understanding what can be modified on an instance.`,
  parameters: z.object({
    path: z.string().describe("Full instance path"),
  }),
  async execute(params) {
    if (!(await isStudioConnected())) {
      return { title: "Not connected", output: notConnectedError(), metadata: { path: params.path } }
    }

    const result = await studioRequest<PropertyInfo[]>("/instance/properties", { path: params.path })

    if (!result.success) {
      return { title: params.path, output: `Error: ${result.error}`, metadata: { path: params.path } }
    }

    const lines = result.data.map((p) => `${p.name}: ${p.value} (${p.type})`).join("\n")

    return {
      title: params.path,
      output: `Properties of ${params.path}:\n\n${lines}`,
      metadata: { path: params.path },
    }
  },
})

export const RobloxSetPropertyTool = Tool.define<
  z.ZodObject<{
    path: z.ZodString
    property: z.ZodString
    value: z.ZodString
  }>,
  { path: string }
>("roblox_set_property", {
  description: `Set a property value on an instance in Roblox Studio.

The value is parsed based on the property type:
- Numbers: "10", "3.14"
- Booleans: "true", "false"
- Strings: "Hello World"
- Vector3: "1, 2, 3"
- Color3: "255, 128, 0" (RGB 0-255) or "#FF8800"
- BrickColor: "Bright red"
- Enum: "Enum.Material.Plastic"`,
  parameters: z.object({
    path: z.string().describe("Full instance path"),
    property: z.string().describe("Property name to set"),
    value: z.string().describe("New value for the property"),
  }),
  async execute(params) {
    if (!(await isStudioConnected())) {
      return { title: "Not connected", output: notConnectedError(), metadata: { path: params.path } }
    }

    const result = await studioRequest<{ path: string }>("/instance/set", {
      path: params.path,
      property: params.property,
      value: params.value,
    })

    if (!result.success) {
      return { title: params.path, output: `Error: ${result.error}`, metadata: { path: params.path } }
    }

    return {
      title: params.path,
      output: `Set ${params.property} = ${params.value} on ${result.data.path}`,
      metadata: { path: result.data.path },
    }
  },
})

export const RobloxCreateTool = Tool.define<
  z.ZodObject<{
    className: z.ZodString
    parent: z.ZodString
    name: z.ZodOptional<z.ZodString>
  }>,
  { path: string }
>("roblox_create", {
  description: `Create a new instance in Roblox Studio.

Common class names:
- Scripts: Script, LocalScript, ModuleScript
- Parts: Part, MeshPart, UnionOperation
- UI: ScreenGui, Frame, TextLabel, TextButton
- Values: StringValue, IntValue, BoolValue, ObjectValue
- Other: Folder, Model, RemoteEvent, RemoteFunction`,
  parameters: z.object({
    className: z.string().describe("The class name of the instance to create"),
    parent: z.string().describe("Full path to the parent instance"),
    name: z.string().optional().describe("Name for the new instance"),
  }),
  async execute(params) {
    if (!(await isStudioConnected())) {
      return { title: "Not connected", output: notConnectedError(), metadata: { path: params.parent } }
    }

    const result = await studioRequest<{ path: string }>("/instance/create", {
      className: params.className,
      parent: params.parent,
      name: params.name,
    })

    if (!result.success) {
      return { title: params.parent, output: `Error: ${result.error}`, metadata: { path: params.parent } }
    }

    return {
      title: result.data.path,
      output: `Created ${params.className} at ${result.data.path}`,
      metadata: { path: result.data.path },
    }
  },
})

export const RobloxDeleteTool = Tool.define<
  z.ZodObject<{
    path: z.ZodString
  }>,
  { path: string }
>("roblox_delete", {
  description: `Delete an instance from Roblox Studio.

This permanently removes the instance and all its descendants.
Use with caution - this cannot be undone through the tool.`,
  parameters: z.object({
    path: z.string().describe("Full instance path to delete"),
  }),
  async execute(params, ctx) {
    if (!(await isStudioConnected())) {
      return { title: "Not connected", output: notConnectedError(), metadata: { path: params.path } }
    }

    await ctx.ask({
      permission: "write",
      patterns: [params.path],
      always: [],
      metadata: {},
    })

    const result = await studioRequest<{ deleted: string }>("/instance/delete", { path: params.path })

    if (!result.success) {
      return { title: params.path, output: `Error: ${result.error}`, metadata: { path: params.path } }
    }

    return {
      title: params.path,
      output: `Deleted ${result.data.deleted}`,
      metadata: { path: result.data.deleted },
    }
  },
})

export const RobloxCloneTool = Tool.define<
  z.ZodObject<{
    path: z.ZodString
    parent: z.ZodOptional<z.ZodString>
  }>,
  { path: string }
>("roblox_clone", {
  description: `Clone an instance in Roblox Studio.

Creates a deep copy of the instance and all its descendants.
If parent is not specified, the clone is placed in the same parent as the original.`,
  parameters: z.object({
    path: z.string().describe("Full instance path to clone"),
    parent: z.string().optional().describe("Optional new parent path for the clone"),
  }),
  async execute(params) {
    if (!(await isStudioConnected())) {
      return { title: "Not connected", output: notConnectedError(), metadata: { path: params.path } }
    }

    const result = await studioRequest<{ path: string }>("/instance/clone", {
      path: params.path,
      parent: params.parent,
    })

    if (!result.success) {
      return { title: params.path, output: `Error: ${result.error}`, metadata: { path: params.path } }
    }

    return {
      title: result.data.path,
      output: `Cloned to ${result.data.path}`,
      metadata: { path: result.data.path },
    }
  },
})

export const RobloxSearchTool = Tool.define<
  z.ZodObject<{
    root: z.ZodOptional<z.ZodString>
    name: z.ZodOptional<z.ZodString>
    className: z.ZodOptional<z.ZodString>
    limit: z.ZodOptional<z.ZodNumber>
  }>,
  { count: number }
>("roblox_search", {
  description: `Search for instances in Roblox Studio by name or class.

At least one of name or className must be provided.
Name matching is case-insensitive and supports partial matches.`,
  parameters: z.object({
    root: z.string().optional().describe("Root path to search from (default: game)"),
    name: z.string().optional().describe("Name pattern to match"),
    className: z.string().optional().describe("Class name to filter by"),
    limit: z.number().optional().describe("Maximum results (default: 50)"),
  }),
  async execute(params) {
    if (!params.name && !params.className) {
      return {
        title: "Search",
        output: "Error: At least one of name or className must be provided",
        metadata: { count: 0 },
      }
    }

    if (!(await isStudioConnected())) {
      return { title: "Not connected", output: notConnectedError(), metadata: { count: 0 } }
    }

    const result = await studioRequest<InstanceInfo[]>("/instance/search", {
      root: params.root ?? "game",
      name: params.name,
      className: params.className,
      limit: params.limit ?? 50,
    })

    if (!result.success) {
      return { title: "Search", output: `Error: ${result.error}`, metadata: { count: 0 } }
    }

    if (result.data.length === 0) {
      return { title: "Search", output: "No instances found matching criteria", metadata: { count: 0 } }
    }

    const lines = result.data.map((item) => `- ${item.path} (${item.className})`).join("\n")

    return {
      title: `Found ${result.data.length}`,
      output: `Found ${result.data.length} instance(s):\n\n${lines}`,
      metadata: { count: result.data.length },
    }
  },
})

export const RobloxGetSelectionTool = Tool.define<z.ZodObject<{}>, { count: number }>("roblox_get_selection", {
  description: `Get the currently selected objects in Roblox Studio.

Returns the paths and class names of all selected instances.
Useful for operating on what the user has selected in the Explorer.`,
  parameters: z.object({}),
  async execute() {
    if (!(await isStudioConnected())) {
      return { title: "Not connected", output: notConnectedError(), metadata: { count: 0 } }
    }

    const result = await studioRequest<InstanceInfo[]>("/selection/get")

    if (!result.success) {
      return { title: "Selection", output: `Error: ${result.error}`, metadata: { count: 0 } }
    }

    if (result.data.length === 0) {
      return { title: "Selection", output: "No objects selected in Studio", metadata: { count: 0 } }
    }

    const lines = result.data.map((item) => `- ${item.path} (${item.className})`).join("\n")

    return {
      title: `${result.data.length} selected`,
      output: `Selected objects:\n\n${lines}`,
      metadata: { count: result.data.length },
    }
  },
})

export const RobloxRunCodeTool = Tool.define<
  z.ZodObject<{
    code: z.ZodString
  }>,
  { executed: boolean }
>("roblox_run_code", {
  description: `Execute Luau code in Roblox Studio.

The code runs in the command bar context with full access to game services.
Use print() to output results - they will be captured and returned.

Examples:
- print(game.Workspace:GetChildren())
- game.Players.LocalPlayer.Character:MoveTo(Vector3.new(0, 10, 0))
- for _, part in game.Workspace:GetDescendants() do if part:IsA("BasePart") then part.Anchored = true end end`,
  parameters: z.object({
    code: z.string().describe("Luau code to execute"),
  }),
  async execute(params, ctx) {
    if (!(await isStudioConnected())) {
      return { title: "Not connected", output: notConnectedError(), metadata: { executed: false } }
    }

    await ctx.ask({
      permission: "write",
      patterns: ["roblox:execute"],
      always: [],
      metadata: {},
    })

    const result = await studioRequest<{ output: string; error?: string }>("/code/run", { code: params.code })

    if (!result.success) {
      return { title: "Run code", output: `Error: ${result.error}`, metadata: { executed: false } }
    }

    if (result.data.error) {
      return {
        title: "Run code",
        output: `Script error:\n${result.data.error}`,
        metadata: { executed: false },
      }
    }

    return {
      title: "Run code",
      output: result.data.output || "Code executed successfully (no output)",
      metadata: { executed: true },
    }
  },
})
