import { GraphORM } from './GraphORM'
import { toPairs, pipe, groupBy } from 'remeda'

export interface TableInfo {
  tableName: string
  columnName: string
  dataType: string
}

export interface RelationInfo {
  tableName: string
  columnName: string
  foreignTableName: string
  foreignColumnName: string
}

export class DatabaseSchema {
  private _tables?: TableInfo[]
  private _relationInfo?: RelationInfo[]

  constructor(private orm: GraphORM) {}

  get tables() {
    if (!this._tables) {
      throw new Error('DatabaseSchema is not initialized yet.')
    }
    return this._tables
  }

  get relationInfo() {
    if (!this._relationInfo) {
      throw new Error('DatabaseSchema is not initialized yet.')
    }
    return this._relationInfo
  }

  async init() {
    const tableColumns = await this.orm.pg.query(`
      select
             t.table_name as "tableName",
             column_name  as "columnName",
             data_type    as "dataType"
      from information_schema.tables t
      inner join information_schema.columns c on c.table_name = t.table_name
                                      and c.table_schema = t.table_schema
      where t.table_name not like 'knex_%'
            and t.table_schema not in ('information_schema', 'pg_catalog')
            and t.table_type = 'BASE TABLE'
      ORDER BY t.table_name
    `)
    this._tables = tableColumns.rows

    const foreigns = await this.orm.pg.query(`
      SELECT
           tc.table_name   AS "tableName",
           kcu.column_name AS "columnName",
           ccu.table_name  AS "foreignTableName",
           ccu.column_name AS "foreignColumnName"
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
    this._relationInfo = foreigns.rows
  }

  toPairs(): Array<[string, TableInfo[]]> {
    return pipe(
      this.tables,
      groupBy((row) => row.tableName),
      toPairs,
    )
  }
}
