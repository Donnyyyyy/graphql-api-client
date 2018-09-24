# GraphQL API client

This module is a simple graphql API client supported query building.

## Sneaky-peaky code

Here is quick example how it works

```js
import GraphqlCLient from 'graphql-api-client';
// Your api schema
import schema from '../schema.json';

// Args are optional, here is default values:
let client = new GraphqlCLient({
    apiUrl = 'graphql',
    wsApiUrl = null,
    wsStreamName = 'graphql',
    reqParams = {},
    schemaUrl = '/schema.json',
    baseQueryName = 'Query',
    baseMutationName = 'Mutation',
    onlyQueries = null,
    onlyMutations = null,
    synced = [],
    onData = () => { },
    onError = () => { },
    vaerbose = false
})

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

- ``apiUrl`` - default: ``/graphql``
- ``reqParams`` - requests parameters such as headers, mode and so on - default: ``{}``
- ``schemaUrl`` - valid graphql schema url to be fetched from - default: ``/schema.json``
- ``baseQueryName`` - parent query name containing all queries as fields - default: ``Query``
- ``baseMutationName`` - parent query name containing all mutations as fields - default: ``Mutation``
- ``onlyQueries`` - list of query names you need to be used only, if ``null`` is passed all parent query fields will be used - default: ``null``
- ``onlyMutations`` - list of mutations names you need to be used only, if ``null`` is passed all parent mutation fields will be used - default: ``null``
- ``synced`` - list of query names that take no parameters to be synced just after creating the client - default: ``[]``
- ``onData`` - function called when any data is recieved from server - default: ``() => { }``
- ``onError`` - function called if an error returned from server - default: ``() => { }``

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

## Notes

Also supports file uploads, just set a variable to file instance. Backend should handle ``multipart/farm-data`` requests for graphql this way. See [graphql-multipart-request-spec](https://github.com/jaydenseric/graphql-multipart-request-spec) for more info.

