import test from 'ava'
import { GraphORM } from './GraphORM'
import { gql, testConfig, createTestData, createTestSchema } from './test-utils'
import { Client } from 'pg'

test.beforeEach(async () => {
  const pg = new Client({ connectionString: testConfig.connection })
  await pg.connect()
  await pg.query(`
    DROP SCHEMA public CASCADE;
    CREATE SCHEMA public;
  `)
})

test.serial('GraphORM', async (t) => {
  t.truthy(GraphORM)
  const orm = new GraphORM(testConfig)
  t.truthy(orm)
})

test.serial('printSchema', async (t) => {
  const orm = new GraphORM(testConfig)
  await createTestSchema(orm.knex)
  await orm.init()
  t.is(
    gql(orm.printSchema()),
    gql`
      type Query {
        posts: [Post]
        users: [User]
      }

      type Post {
        id: String
        userId: String
        title: String
        user: User
      }

      type User {
        id: String
        name: String
        posts: [Post]
      }
    `,
  )
})

test.serial('hasMany', async (t) => {
  const orm = new GraphORM(testConfig)

  await createTestSchema(orm.knex)
  await orm.init()

  const usersQuery = gql`
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

  t.deepEqual(await orm.graphql(usersQuery), {
    data: {
      users: [],
    },
  })

  await createTestData(orm.knex)

  t.deepEqual(await orm.graphql(usersQuery), {
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

test.serial('belongsTo', async (t) => {
  const orm = new GraphORM(testConfig)

  await createTestSchema(orm.knex)
  await orm.init()

  await createTestData(orm.knex)

  const postsQuery = gql`
    query {
      posts {
        id
        title
        user {
          id
          name
        }
      }
    }
  `

  t.deepEqual(await orm.graphql(postsQuery), {
    data: {
      posts: [
        {
          id: '1',
          title: 'GraphORM is awesome',
          user: {
            id: '1',
            name: 'Kay',
          },
        },
      ],
    },
  })
})
