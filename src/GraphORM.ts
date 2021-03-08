import { Client } from 'pg'
import camelcase from 'camelcase'
import { tableNameToTypeName } from './helpers'
import { DatabaseSchema } from './DatabaseSchema'
import { Model, Field } from './Model'
import {
  graphql,
  GraphQLSchema,
  // GraphQLInt,
  // GraphQLNonNull,
  GraphQLList,
  GraphQLObjectType,
} from 'graphql'

export interface GraphORMOptions {
  connection: string
}

export class GraphORM {
  pg: Client
  typeMap = new Map<string, GraphQLObjectType>()
  private databaseSchema: DatabaseSchema
  private _schema?: GraphQLSchema

  constructor(options: GraphORMOptions) {
    this.pg = new Client({ connectionString: options.connection })
    this.databaseSchema = new DatabaseSchema(this)
  }

  get schema() {
    if (!this._schema) {
      throw new Error('Schema is not initialized yet.')
    }
    return this._schema
  }

  async init() {
    await this.pg.connect()
    await this.databaseSchema.init()

    const typeMap = new Map<string, GraphQLObjectType>()
    const modelsMap = new Map<string, Model>()

    this.databaseSchema.toPairs().forEach(([tableName, columns]) => {
      const fields: Field[] = columns.map((column) => ({
        kind: 'ScalarField',
        name: column.columnName,
        nullable: false, // TODO
        type: 'string',
      }))
      const relations = this.databaseSchema.relationInfo
        .filter((info) => info.foreignTableName === tableName)
        .map((relation) => ({
          kind: 'HasManyField' as const, // TODO
          name: camelcase(relation.tableName),
          nullable: false, // TODO
          type: 'Post',
        }))
      // TODO: use databaseSchema.relationInfo
      modelsMap.set(
        tableName,
        new Model(tableName, [...fields, ...relations], this),
      )
    })

    modelsMap.forEach((model, tableName) => {
      typeMap.set(tableNameToTypeName(tableName), model.toGraphQLType(typeMap))
    })

    const query = new GraphQLObjectType({
      name: 'Query',
      fields: {
        users: {
          type: new GraphQLList(typeMap.get('User')!),
          resolve: () =>
            this.pg.query('select * from users').then((res) => res.rows),
        },
      },
    })

    typeMap.set('Query', query)

    this.typeMap = typeMap

    this._schema = new GraphQLSchema({
      query,
    })
  }

  async graphql(query: string) {
    return graphql({
      schema: this.schema,
      source: query,
    })
  }
}
