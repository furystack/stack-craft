import stacksApiSchema from 'common/schemas/stacks-api.json' with { type: 'json' }
import type { JSONSchema } from 'monaco-editor/languages/features/json/register.js'

const { $schema, ...schemaWithoutMeta } = stacksApiSchema

// @ts-expect-error TODO: Fix me later
export const stackExportSchema: JSONSchema = {
  $ref: '#/definitions/ExportStackResult',
  ...schemaWithoutMeta,
}
