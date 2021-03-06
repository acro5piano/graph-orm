import camelcase from 'camelcase'
import pluralize from 'pluralize'

export function gql(literals: TemplateStringsArray) {
  return literals[0] as string
}

export function tableNameToTypeName(tableName: string) {
  return pluralize.singular(
    camelcase(tableName, {
      pascalCase: true,
    }),
  )
}

export function isFunction(obj: any): obj is Function {
  return typeof obj === 'function'
}
