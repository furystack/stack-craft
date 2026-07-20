import stacksApiSchema from 'common/schemas/stacks-api.json' with { type: 'json' }

const { $schema, ...schemaWithoutMeta } = stacksApiSchema

export const stackExportSchema = {
  $ref: '#/definitions/ExportStackResult',
  ...schemaWithoutMeta,
}
