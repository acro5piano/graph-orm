import { knex, Knex } from 'knex'
import camelcase from 'camelcase'
import pluralize from 'pluralize'

import { tableNameToTypeName } from './helpers'
import { DatabaseSchema } from './DatabaseSchema'
import { Model, Field } from './Model'
import {
  printSchema,
  graphql,
  GraphQLSchema,
  GraphQLFieldConfigMap,
  // GraphQLInt,
  GraphQLNonNull,
  GraphQLList,
  GraphQLObjectType,
} from 'graphql'

// @see https://github.com/khmm12/knex-tiny-logger/issues/9
import knexTinyLogger from 'knex-tiny-logger'

const knexStringcase = require('knex-stringcase')

export interface GraphORMOptions {
  connection: string
  logSql?: boolean
}

export class GraphORM {
  knex: Knex
  typeMap = new Map<string, GraphQLObjectType>()
  private databaseSchema: DatabaseSchema
  private _schema?: GraphQLSchema

  constructor(options: GraphORMOptions) {
    this.knex = knex(
      knexStringcase({
        client: 'pg',
        connection: options.connection,
      }),
    )
    if (options.logSql) {
      knexTinyLogger(this.knex)
    }

    this.databaseSchema = new DatabaseSchema(this)
  }

  get schema() {
    if (!this._schema) {
      throw new Error('Schema is not initialized yet.')
    }
    return this._schema
  }

  async init() {
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

      // TODO: Adding a unique constraint to the relation table column for the table. c.f.) https://hasura.io/docs/latest/graphql/core/guides/data-modelling/one-to-one.html#one-to-one-modelling
      const hasManyRelations = this.databaseSchema.relationInfo
        .filter((info) => info.foreignTableName === tableName)
        .map((relation) => ({
          kind: 'HasManyField' as const,
          name: camelcase(relation.tableName),
          nullable: false, // TODO
          type: tableNameToTypeName(relation.tableName), // TODO
          fromColumn: camelcase(relation.foreignColumnName),
          toColumn: camelcase(relation.columnName),
        }))
      const belongsToOneRelations = this.databaseSchema.relationInfo
        .filter((info) => info.tableName === tableName)
        .map((relation) => ({
          kind: 'BelongsToOneField' as const, // TODO
          name: camelcase(pluralize.singular(relation.foreignTableName)),
          nullable: false, // TODO
          type: tableNameToTypeName(relation.foreignTableName), // TODO
          fromColumn: camelcase(relation.columnName),
          toColumn: camelcase(relation.foreignColumnName),
        }))
      modelsMap.set(
        tableName,
        new Model(
          tableName,
          [...fields, ...hasManyRelations, ...belongsToOneRelations],
          this,
        ),
      )
    })

    const rootFields: GraphQLFieldConfigMap<any, any> = {}

    modelsMap.forEach((model, tableName) => {
      const typeName = tableNameToTypeName(tableName)
      typeMap.set(typeName, model.toGraphQLType(typeMap))
      rootFields[camelcase(tableName)] = {
        type: new GraphQLList(new GraphQLNonNull(typeMap.get(typeName)!)),
        resolve: () => this.knex(tableName),
      }
    })

    const query = new GraphQLObjectType({
      name: 'Query',
      fields: rootFields,
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

  printSchema() {
    return printSchema(this.schema)
  }
}
