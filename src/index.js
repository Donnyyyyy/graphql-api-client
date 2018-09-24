import client from './client';
import { getRootQuery, getRootMutation, getQueryString, getField } from './utils';


export default class GraphqlClient {

    constructor({
        apiUrl = '/graphql',
        reqParams = {},
        schema = null,
        onData = () => { },
        onError = () => { },
        verbose = false,
    }) {
        this.verbose = verbose;
        this.apiUrl = apiUrl;
        this.params = reqParams;
        this.onData = onData;
        this.onError = onError;
        this.schema = schema;

        this._client = client(this.apiUrl, this.params);
        this._rootQuery = this.schema ? getRootQuery(this.schema) : null;
        this._rootMutation = this.schema ? getRootMutation(this.schema) : null;
    }
    
    query(queryName, args) {
        const query = getField(queryName);
        const queryString = getQueryString(this.schema, query, args);
        if (this.verbose) {
            console.debug(queryString); //eslint-disable-line no-console
        }
        this.go(queryString, args);
    }

    mutate(mutationName, args) {
        const mutation = getField(mutationName);
        const mutationString = getQueryString(this.schema, mutation, args);
        if (this.verbose) {
            console.debug(mutationString); //eslint-disable-line no-console
        }
        this.go(mutationString, args);
    }
    
    get go() {
        return (...args) => {
            return this._client(...args)
                .then((data) => {
                    this.onData(data);
                    return data;
                })
                .catch((error) => {
                    this.onError(error);
                    throw error;
                });
        };
    }
}
