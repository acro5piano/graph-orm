import { Client } from 'pg'
import { toPairs, map, pipe, groupBy } from 'remeda'
import camelcase from 'camelcase'
import { tableNameToTypeName } from './helpers'
import { DatabaseSchema } from './DatabaseSchema'
import {
  graphql,
  GraphQLSchema,
  GraphQLID,
  // GraphQLInt,
  // GraphQLNonNull,
  GraphQLList,
  GraphQLObjectType,
  GraphQLString,
} from 'graphql'

export interface GraphORMOptions {
  connection: string
}

export class GraphORM {
  pg: Client
  typeMap = new Map<string, GraphQLObjectType>()
  private _schema?: GraphQLSchema
  private _databaseSchema?: DatabaseSchema

  constructor(options: GraphORMOptions) {
    this.pg = new Client({
      connectionString: options.connection,
    })
  }

  get schema() {
    if (!this._schema) {
      throw new Error('Schema is not initialized yet.')
    }
    return this._schema
  }

  get databaseSchema() {
    if (!this._databaseSchema) {
      throw new Error('Schema is not initialized yet.')
    }
    return this._databaseSchema
  }

  private async dumpSchemaAndSave() {
    const tableColumns = await this.pg.query<{
      table_name: string
      column_name: string
      data_type: string
    }>(`
      select
             t.table_name, column_name, data_type
      from information_schema.tables t
      inner join information_schema.columns c on c.table_name = t.table_name
                                      and c.table_schema = t.table_schema
      where t.table_name not like 'knex_%'
            and t.table_schema not in ('information_schema', 'pg_catalog')
            and t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `)

    const foreigns = await this.pg.query<{
      table_name: string
      column_name: string
      foreign_table_name: string
      foreign_column_name: string
    }>(`
      SELECT
           tc.table_schema,
           tc.constraint_name,
           tc.table_name,
           kcu.column_name,
           ccu.table_schema AS foreign_table_schema,
           ccu.table_name AS foreign_table_name,
           ccu.column_name AS foreign_column_name
      FROM
           information_schema.table_constraints AS tc
           JOIN information_schema.key_column_usage AS kcu
             ON tc.constraint_name = kcu.constraint_name
             AND tc.table_schema = kcu.table_schema
           JOIN information_schema.constraint_column_usage AS ccu
             ON ccu.constraint_name = tc.constraint_name
             AND ccu.table_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
    `)

    this._databaseSchema = new DatabaseSchema(tableColumns.rows, foreigns.rows)
  }

  async initializeSchema() {
    await this.pg.connect()
    await this.dumpSchemaAndSave()

    const typeMap = new Map<string, GraphQLObjectType>()

    pipe(
      this.databaseSchema.tables,
      groupBy((row) => row.table_name),
      toPairs,
      map(([tableName, columns]) => {
        typeMap.set(
          tableNameToTypeName(tableName),
          new GraphQLObjectType({
            name: tableNameToTypeName(tableName),
            fields: () => {
              const id = {
                type: GraphQLID,
              }
              const scalarFields = columns.reduce(
                (fields, column) => ({
                  ...fields,
                  [column.column_name]: {
                    type: GraphQLString,
                  },
                }),
                {} as any,
              )
              const relationFields = this.databaseSchema.relations.reduce(
                (fields, foreign) => ({
                  ...fields,
                  [camelcase(foreign.table_name)]: {
                    type: new GraphQLList(
                      typeMap.get(tableNameToTypeName(foreign.table_name))!,
                    ),
                  },
                }),
                {} as any,
              )
              return { id, ...scalarFields, ...relationFields }
            },
          }),
        )
      }),
    )

    const query = new GraphQLObjectType({
      name: 'Query',
      fields: {
        users: {
          type: new GraphQLList(typeMap.get('User')!),
          resolve: () => [],
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
