import { Knex } from 'knex'

export const testConfig = {
  connection: 'postgres://postgres:postgres@127.0.0.1:45432/postgres',
  logSql: true,
}

export async function resetDatabase(knex: Knex) {
  await knex.raw(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
  `)
}

export async function createTestSchema(knex: Knex) {
  await knex.schema.createTable('users', (t) => {
    t.increments('id')
    t.string('name').notNullable().defaultTo('')
  })
  await knex.schema.createTable('posts', (t) => {
    t.increments('id')
    t.integer('user_id').notNullable().references('users.id')
    t.string('title').notNullable().defaultTo('')
  })
}

export async function createTestData(knex: Knex) {
  const rows = await knex('users')
    .insert({
      name: 'Kay',
    })
    .returning('*')
  await knex('posts').insert({
    userId: rows[0].id,
    title: 'GraphORM is awesome',
  })
}

export function gql(arg: string | TemplateStringsArray) {
  const target = typeof arg === 'string' ? arg : arg[0]
  if (!target) {
    return ''
  }
  return target
    .replace(/\n/g, '')
    .replace(/ +/g, ' ')
    .replace(/^ /, '')
    .replace(/ $/, '')
    .replace(/ ?({|}|:|,) ?/g, '$1')
    .replace(/\.\.\. /g, '...')
}
