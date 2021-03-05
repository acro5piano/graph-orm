# GraphORM

[experimental] GraphQL oriented Node.js ORM for PostgreSQL focusng on querying & ACL.

# Design Goal

### Automatic schema generation

GraphORM generates GraphQL schema from PostgreSQL schema. No redundant code required.

### Query everything with GraphQL

GraphORM is intended to query data even local operation to make everything simple.

### Performant

GraphORM compiles GraphQL into performant SQL. No N+1 problem by default.

### ACL support

GraphORM handles Access Control with row-level, column-level, and both.

### Framework agnostic

GraphORM is an ORM. ORM dones't touch HTTP layer. You can use your favorite technologies.

### Based on Knex

GraphORM focues on quering and ACL, so delegate other staff to Knex. Less is more. You can even mix GraphORM with other ORMs like Objection.js, mikro-orm, and so on.

# Spec

### Basic

```typescript
import { GraphORM, gql } from '@graph-orm/core'
import Knex from 'knex'

const knex = new Knex({
  client: 'pg',
  connection: 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
})

const orm = new GraphORM({ knex })

async function mutate() {
  await knex.raw(`
    insert into users(name) values ('Kay');
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
import Knex from 'knex'
import Fastify from 'fastify'

const knex = new Knex({
  client: 'pg',
  connection: 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
})

const orm = new GraphORM({ knex })

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
import Knex from 'knex'
import Fastify from 'fastify'

const knex = new Knex({
  client: 'pg',
  connection: 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
})

const orm = new GraphORM({ knex })

const orm = new GraphORM({
  connection: 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
  acl: [
    {
      table: 'users',
      rules: [
        {
          column: 'email',
          // This is queried while executing the SQL
          checks: ['users.id = :userId'],
        },
      ],
    },
    {
      table: 'posts',
      rules: [
        {
          column: '*',
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
          column: '*',
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
            async((user) => {
              return ExternalAPIClient.get(user.id).then((res) => res.ok)
            }),
          ],
        },
      ],
    },
  ],
})

orm.graphql(
  gql`
    query {
      users {
        id
        name
        email
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

### Mutation and Context

GraphORM focues on querying, so you should write your own logic for mutations. I personally don't think writing GraphQL is not hard thing, compared to writing performant query.

```typescript
import { GraphORM, gql } from '@graph-orm/core'
import Knex from 'knex'

const knex = new Knex({
  client: 'pg',
  connection: 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
})

const orm = new GraphORM({
  knex,
})

interface Context {
  userId: number
}

orm.extendSchema(gql`
  input UserInput {
    name: String
  }

  type Mutation {
    updateUser(input: UserInput!): User
  }
`)

orm.defineMutations({
  updateUser: (_, args: UpdateUserArgs, ctx: Context) => {
    return orm.knex('users').update(input).where({ id }).returing('*')
  },
})
```
