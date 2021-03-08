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

export type Field = ScalarField | HasManyField | HasOneField

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
}

interface HasOneField extends BaseField {
  kind: 'HasManyField'
  type: string
}

// function isModel(s: Scalar | Model): s is Model {
//   return s instanceof Model
// }

function isScalar(s: Scalar | string): s is Scalar {
  return ['string', 'integer', 'boolean', 'id'].includes(s as Scalar)
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
          if (isScalar(field.type)) {
            return {
              ...fields,
              [field.name]: {
                type: scalarToGraphQLType(field.type),
              },
            }
          } else {
            return {
              ...fields,
              [field.name]: {
                // TODO: consider has_one
                type: new GraphQLList(typeMap.get(field.type)!),

                // TODO: use batch loader by Context
                resolve: () => {
                  return this.orm.pg
                    .query(`select * from "${field.name}"`) // TODO: add check table name for SQL injection
                    .then((res) => res.rows)
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
