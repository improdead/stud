import { Hono } from "hono"
import { describeRoute, resolver, validator } from "hono-openapi"
import z from "zod"
import { lazy } from "../../util/lazy"
import { RojoParser } from "../../roblox/project-parser"
import { Instance } from "../../project/instance"

const InstanceNodeSchema: z.ZodType<RojoParser.InstanceNode> = z.lazy(() =>
  z.object({
    name: z.string(),
    className: z.string(),
    path: z.string(),
    filePath: z.string().optional(),
    children: z.array(InstanceNodeSchema).optional(),
  }),
)

export const InstanceTreeRoutes = lazy(() =>
  new Hono()
    .get(
      "/tree",
      describeRoute({
        summary: "Get instance tree",
        description: "Get the parsed Rojo project instance tree for the current directory",
        operationId: "instance.tree",
        responses: {
          200: {
            description: "Instance tree",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    tree: InstanceNodeSchema.nullable(),
                    projectFile: z.string().nullable(),
                  }),
                ),
              },
            },
          },
        },
      }),
      async (c) => {
        const directory = Instance.directory
        const tree = await RojoParser.parse(directory)
        const projectFile = await RojoParser.findProjectFile(directory)
        return c.json({ tree, projectFile })
      },
    )
    .get(
      "/tree/:directory",
      describeRoute({
        summary: "Get instance tree for directory",
        description: "Get the parsed Rojo project instance tree for a specific directory",
        operationId: "instance.tree.directory",
        responses: {
          200: {
            description: "Instance tree",
            content: {
              "application/json": {
                schema: resolver(
                  z.object({
                    tree: InstanceNodeSchema.nullable(),
                    projectFile: z.string().nullable(),
                  }),
                ),
              },
            },
          },
        },
      }),
      validator("param", z.object({ directory: z.string() })),
      async (c) => {
        const directory = decodeURIComponent(c.req.valid("param").directory)
        const tree = await RojoParser.parse(directory)
        const projectFile = await RojoParser.findProjectFile(directory)
        return c.json({ tree, projectFile })
      },
    ),
)
