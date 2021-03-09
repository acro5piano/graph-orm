import test from 'ava'
import { GraphORM } from './GraphORM'
import { gql, testConfig, createTestData, createTestSchema } from './test-utils'

test.serial('GraphORM', async (t) => {
  t.truthy(GraphORM)
  const orm = new GraphORM(testConfig)
  t.truthy(orm)
})

test.serial('printSchema', async (t) => {
  const orm = new GraphORM(testConfig)
  await orm.init()
  await createTestSchema(orm)
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

  await orm.init()
  await createTestSchema(orm)

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

  await createTestData(orm)

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

  await orm.init()
  await createTestSchema(orm)
  await createTestData(orm)

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
