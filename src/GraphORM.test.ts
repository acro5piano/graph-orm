import test from 'ava'
import { GraphORM } from './GraphORM'
import { gql } from './helpers'

async function createTestSchema(orm: GraphORM) {
  await orm.pg.query(`
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

test('GraphORM', async (t) => {
  t.truthy(GraphORM)
  const orm = new GraphORM({
    connection: 'postgres://postgres:postgres@127.0.0.1:45432/postgres',
  })
  t.truthy(orm)
  await orm.initializeSchema()
  await createTestSchema(orm)

  const res = await orm.graphql(gql`
    query {
      users {
        id
        name
        posts {
          id
          title
        }
      }
    }
  `)

  t.deepEqual(res, {
    data: {
      users: [],
    },
  })
})
