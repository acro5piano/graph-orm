import { GraphORM } from './GraphORM'

export const testConfig = {
  connection: 'postgres://postgres:postgres@127.0.0.1:45432/postgres',
  logSql: true,
}

export async function createTestSchema(orm: GraphORM) {
  await orm.knex.raw(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;

    CREATE TABLE users (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) not null default ''
    );

    CREATE TABLE posts (
      id SERIAL PRIMARY KEY,
      user_id integer not null,
      title VARCHAR(255) not null default ''
    );

    ALTER TABLE "posts" ADD CONSTRAINT "posts_user_id_foreign" FOREIGN KEY ("user_id") REFERENCES "users" ("id") ON DELETE CASCADE;
  `)
}

export async function createTestData(orm: GraphORM) {
  const rows = await orm
    .knex('users')
    .insert({
      name: 'Kay',
    })
    .returning('*')
  await orm.knex('posts').insert({
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
