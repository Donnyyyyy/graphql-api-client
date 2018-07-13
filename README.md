# GraphQL API client

This module is a simple graphql API client supported query building.

## Sneaky-peaky code

Here is quick example how it works

```js
import GraphqlCLient from 'graphql-api-client';
// Your api schema
import schema from '../schema.json';

let client = new GraphqlCLient('http://put.your/graphql/endpoit/here', {
   headers: {
      Authorization: `Token ${sometoken}`
   }
});

client.init(
   // Queries you gonna use
   ['login', ],
   // Mutations you gonna use
   ['changeProfile', ],
   // Queries you want to be synced
   ['isLoggedIn', ],
   // onData hook
   console.log,
   // onError hook
   console.error
);

// Make a query
client.query('login', {
   username: 'some@email.here',
   password: 'password here'
}).then(data => {
   let isLoggedIn = data.login;
   // Some logic
});


// Perform a mutation
client.mutate('changeProfile', {
   data: {
      firstName: 'John',
      lastName: 'White',
   }
}).then(data => {
   let newProfileData = data.changeProfile;
});
```

## Setting up

### Contructor

Contructor accepts connection params:

- api url ``[str]``
- requests parameters such as headers, mode and so on ``[dict]``

### ``init``

Before you start querying, call ``init`` method.

Args:

- ``schema`` - valid graphql schema ``object``
- ``queries`` - list of query names you need to be used
- ``mutations`` - list of mutation names you need to be used
- ``synced`` - list of query names that take no parameters to be synced just after ``init``
- ``onData`` - function called when any data is recieved from server
- ``onError`` - function called if an error returned from server

If you want to implement some kind of storage - ``onData`` is what you need, all data goes through it.

TODO: make ``synced`` items to update dynamically through websockets

## Query

To make a query call

```js
client.query('queryName', {
   param1: data
})
```

Returns a ``Promise`` resolving single ``object`` containing keys whose names equal to ``queryName``

## Mutation

To perform a mutation call

```js
client.mutate('mutationName', {
   param1: data
})
```

Returns a ``Promise`` resolving single ``object`` containing keys whose names equal to ``mutationName``



