export interface TableInfo {
  table_name: string
  column_name: string
  data_type: string
}

export interface RelationInfo {
  table_name: string
  column_name: string
  foreign_table_name: string
  foreign_column_name: string
}

export class DatabaseSchema {
  constructor(public tables: TableInfo[], public relations: RelationInfo[]) {}
}
