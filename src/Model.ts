import camelcase from 'camelcase'
import pluralize from 'pluralize'
import {
  GraphQLList,
  GraphQLBoolean,
  GraphQLString,
  GraphQLID,
  GraphQLInt,
  GraphQLObjectType,
} from 'graphql'
import { tableNameToTypeName } from './helpers'
import { GraphORM } from './GraphORM'

export type Field = ScalarField | HasManyField | HasOneField | BelongsToOneField

type Scalar = 'string' | 'integer' | 'boolean' | 'id'
type FieldType = string | Scalar

interface BaseField {
  nullable: boolean
  name: string
  type: FieldType
}

interface ScalarField extends BaseField {
  kind: 'ScalarField'
  type: Scalar
}

interface HasManyField extends BaseField {
  kind: 'HasManyField'
  type: string
  fromColumn: string
  toColumn: string
}

interface HasOneField extends BaseField {
  kind: 'HasOneField'
  type: string
  fromColumn: string
  toColumn: string
}

interface BelongsToOneField extends BaseField {
  kind: 'BelongsToOneField'
  type: string
  fromColumn: string
  toColumn: string
}

// function isModel(s: Scalar | Model): s is Model {
//   return s instanceof Model
// }

function isScalarField(field: Field): field is ScalarField {
  return ['string', 'integer', 'boolean', 'id'].includes(field.type as Scalar)
}

function scalarToGraphQLType(s: Scalar) {
  switch (s) {
    case 'string':
      return GraphQLString
    case 'integer':
      return GraphQLInt
    case 'id':
      return GraphQLID
    case 'boolean':
      return GraphQLBoolean
    default:
      throw new Error(`Unkown scalar: ${s}`)
  }
}

export class Model {
  private _type?: GraphQLObjectType

  constructor(
    private tableName: string,
    private fields: Field[],
    private orm: GraphORM,
  ) {}

  toGraphQLType(typeMap: Map<string, GraphQLObjectType>): GraphQLObjectType {
    if (this._type) {
      return this._type
    }
    const typeName = tableNameToTypeName(this.tableName)

    return new GraphQLObjectType({
      name: typeName,
      fields: () => {
        // TODO: this is hard coded, but should be taken from serial key
        const id = {
          type: GraphQLID,
        }
        // TODO: this code is not type-safe
        const fields = this.fields.reduce((fields, field) => {
          if (isScalarField(field)) {
            return {
              ...fields,
              [camelcase(field.name)]: {
                type: scalarToGraphQLType(field.type),
              },
            }
          } else {
            return {
              ...fields,
              [camelcase(field.name)]: {
                type:
                  field.kind === 'HasManyField'
                    ? new GraphQLList(typeMap.get(field.type)!)
                    : typeMap.get(field.type)!,

                // TODO: use batch loader by Context
                resolve: (root: any) => {
                  if (field.kind === 'HasManyField') {
                    return this.orm.knex
                      .select('*')
                      .from(field.name)
                      .where({ [field.toColumn]: root[field.fromColumn] })
                  } else if (field.kind === 'HasOneField') {
                    return this.orm.knex
                      .select('*')
                      .from(field.name)
                      .where({ [field.toColumn]: root[field.fromColumn] })
                      .first()
                  } else if (field.kind === 'BelongsToOneField') {
                    return this.orm.knex
                      .select('*')
                      .from(pluralize(field.name))
                      .where({ [field.toColumn]: root[field.fromColumn] })
                      .first()
                  }
                  throw new Error('Cannot resolve type')
                },
              },
            }
          }
        }, {} as any)
        return { id, ...fields }
      },
    })
  }
}
