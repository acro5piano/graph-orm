# GraphORM

[experimental] GraphQL oriented Node.js ORM for PostgreSQL.

# Design Goal

- **Automatic schema generation** GraphORM generates GraphQL schema from PostgreSQL schema. No redundant code required.
- **Query everything with GraphQL** GraphORM is intended to query/mutate data even local operations to make everything simple.
- **Performant** GraphORM compiles GraphQL into performant SQL. No N+1 problem by default.
- **ACL support** GraphORM handles Access Control with row-level, column-level, and both.
- **Framework agnostic** GraphORM is an ORM. ORM dones't touch HTTP layer. You can use your favorite technologies.
- **Extensible**: Easy to extend schema for custom resolvers

# Spec

This is just README. No implementation. Just a concept.

### Basic

```typescript
import { GraphORM, gql } from '@graph-orm/core'

const orm = new GraphORM({
  connection: 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
})

async function mutate() {
  await orm.graphql(gql`
    mutation {
      insertUsers(objects: [{ name: "Kay" }]) {
        reeturning {
          id
          name
        }
      }
    }
  `)
}

async function query() {
  return orm.graphql(gql`
    query {
      users {
        id
        name
      }
    }
  `)
}

async function main() {
  await mutate()
  const { data } = await query()
  console.log(data)
  // outputs:
  //
  // {
  //   data: {
  //     users: [
  //       {
  //         id: 1,
  //         name: 'Kay',
  //       },
  //     ]
  //   }
  // }
}
```

### With HTTP layer

In this example we use `fastify`, but anything can be here.

```typescript
import { GraphORM, gql } from '@graph-orm/core'
import Fastify from 'fastify'

const orm = new GraphORM({
  connection: 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
})

const app = Fastify()

app.post('/graphql', (request, reply) => {
  const { query, variables } = request.body
  return orm.graphql(query, { variables })
})

app.listen(8080)
```

### ACL

Strong ACL support is hard part of GraphQL. With GraphORM, you can handle with a pretty declarative way:

```typescript
import { GraphORM, gql } from '@graph-orm/core'

const orm = new GraphORM({
  connection: 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
  acl: [
    {
      table: 'users',
      rules: [
        {
          column: 'email',
          type: ['read', 'write'],
          checks: ['users.id = :userId'], // This is compared while executing the SQL
        },
      ],
    },
    {
      table: 'posts',
      rules: [
        {
          columns: ['title', 'content'], // Specify multiple columns at once
          type: ['write'],
          checks: [
            "posts.status = 'public' or posts.user_id = :userId or :userRole = 'ADMIN'",
          ],
        },
      ],
    },
    {
      table: 'posts_tags',
      rules: [
        {
          column: ['post_id', 'tag_id'],
          checks: [
            sql`exists ( select * from posts where posts.user_id = :userId and posts.id = posts_tags.post_id)`,
          ],
        },
      ],
    },
    {
      table: 'users',
      rules: [
        {
          column: 'some_complicated_column',
          // Not performant, but flexible check
          checks: [
            async function checkExternalAPI(user) {
              return ExternalAPIClient.get(user.id).then((res) => res.ok)
            },
          ],
        },
      ],
    },
  ],
})

// Returns
// - every user field where id = 1
// - every posts and its fields where user_id = 1 or status = 'public'
// - only 'id', 'name' from users where id != 1, email become null
orm.graphql(
  gql`
    query {
      users {
        id
        name
        email
        posts {
          id
          title
        }
      }
    }
  `,
  {
    context: {
      userId: 1, // :userId will be replaced with this value
      userRole: 'general', // :userRole will be replaced with this value
    },
  },
)
```

### Extend GraphQL Schema

GraphORM focues on querying, so you should write your own logic for mutations. I personally don't think writing GraphQL is not hard thing, compared to writing performant query.

```typescript
import { GraphORM, gql } from '@graph-orm/core'

const HealthResolver = () => 'ok'

const orm = new GraphORM({
  connection: 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
  customResolvers: [HealthResolver],
})

orm.extendSchema(gql`
  type Query {
    health: String
  }
`)
```
