import stacksApiSchema from 'common/schemas/stacks-api.json' with { type: 'json' }
import type { JSONSchema } from 'monaco-editor/languages/features/json/register.js'

const { $schema, ...schemaWithoutMeta } = stacksApiSchema

export const stackExportSchema = {
  $ref: '#/definitions/ExportStackResult',
  ...schemaWithoutMeta,

  // @ts-expect-error TODO: Fix me later
} satisfies JSONSchema
