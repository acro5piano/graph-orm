# GraphORM

[experimental] GraphQL oriented Node.js ORM for PostgreSQL focused on Querying & ACL.

# Design Goal

### Automatic schema generation

GraphORM generates GraphQL schema from PostgreSQL schema. No redundant code required.

### Query everything with GraphQL

GraphORM is intended to query/mutate data even local operation to make everything simple.

### Performant

GraphORM compiles GraphQL into performant SQL. No N+1 problem by default.

### ACL support

GraphORM handles Access Control with row-level, column-level, and both.

### Framework agnostic

GraphORM is ORM. ORM dones't touch HTTP layer, meaning users can use their favorite technologcy.

# Spec

### Basic

```typescript
import { GraphORM, gql } from '@graph-orm/core'

const orm = new GraphORM({
  connection: 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
})

async function mutate() {
  await orm.raw`
    insert into users(name) values ('Kay');
  `
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
import { GraphORM } from '@graph-orm/core'
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
import Fastify from 'fastify'

const orm = new GraphORM({
  connection: 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
  acl: [
    {
      table: 'users',
      rules: [
        {
          column: 'email',
          checks: ['users.id = :userId'],
        },
      ],
    },
    {
      table: 'posts',
      rules: [
        {
          column: 'title',
          checks: ['posts.user_id = :userId'],
        },
      ],
    },
    {
      table: 'posts_tags',
      rules: [
        {
          column: '*',
          operations: ['write'],
          checks: [
            sql`exists ( select * from posts where posts.user_id = :userId and posts.id = posts_tags.post_id)`,
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
    },
  },
)
```

### Mutation and Context

GraphORM focues on querying, so you should write your own logic for mutations.

```typescript
import { GraphORM, gql } from '@graph-orm/core'

const orm = new GraphORM({
  connection: 'postgres://postgres:postgres@127.0.0.1:5432/postgres',
})

orm.extendSchema(gql`
  input UserInput {
    name: String
  }

  type Mutation {
    updateUser(id: ID!, input: UserInput!): User
  }
`)

interface UserInput {
  name: string
}

interface UpdateUserArgs {
  id: string
  input: UserInput
}

async function updateUser({ id, input }: UpdateUserArgs) {
  await orm.knex('users').update(input).where({ id })
}

orm.defineResolvers({
  Mutation: {
    updateUser: (_, args: UpdateUserArgs) => updateUser(args),
  },
})
```
