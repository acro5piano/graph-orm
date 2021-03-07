import { Client } from 'pg'
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

interface GraphORMOptions {
  connection: string
}

export class GraphORM {
  pg: Client
  private _schema?: GraphQLSchema

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

  async initializeSchema() {
    await this.pg.connect()
    const tableColumns = await this.pg.query(`
      select
             t.table_name, column_name, data_type, *
      from information_schema.tables t
      inner join information_schema.columns c on c.table_name = t.table_name
                                      and c.table_schema = t.table_schema
      where t.table_name not like 'knex_%'
            and t.table_schema not in ('information_schema', 'pg_catalog')
            and t.table_type = 'BASE TABLE'
    `)
    console.log(tableColumns)

    const foreigns = await this.pg.query(`
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
    console.log(foreigns)

    const Post = new GraphQLObjectType({
      name: 'Post',
      fields: {
        id: {
          type: GraphQLID,
        },
        title: {
          type: GraphQLString,
        },
      },
    })

    const User = new GraphQLObjectType({
      name: 'User',
      fields: {
        id: {
          type: GraphQLID,
        },
        name: {
          type: GraphQLString,
        },
        posts: {
          type: new GraphQLList(Post),
        },
      },
    })

    const query = new GraphQLObjectType({
      name: 'Query',
      fields: {
        users: {
          type: new GraphQLList(User),
          resolve: () => [],
        },
      },
    })

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
