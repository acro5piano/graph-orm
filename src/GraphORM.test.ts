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

async function createTestData(orm: GraphORM) {
  const { rows } = await orm.pg.query(`
    insert into users (name) values ('Kay') returning *;
  `)
  await orm.pg.query(
    `
    insert into posts (user_id, title) values ($1, 'GraphORM is awesome') returning *;
  `,
    [rows[0].id],
  )
}

test('GraphORM', async (t) => {
  t.truthy(GraphORM)
  const orm = new GraphORM({
    connection: 'postgres://postgres:postgres@127.0.0.1:45432/postgres',
  })
  t.truthy(orm)
  await orm.init()
  await createTestSchema(orm)

  const query = gql`
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
  `

  t.deepEqual(await orm.graphql(query), {
    data: {
      users: [],
    },
  })

  await createTestData(orm)

  t.deepEqual(await orm.graphql(query), {
    data: {
      users: [
        {
          id: '1',
          name: 'Kay',
          posts: [
            {
              id: '1',
              title: 'GraphORM is awesome',
            },
          ],
        },
      ],
    },
  })
})
