import client from './client';

export default class GraphqlClient {

	get _typeQueryBuilders() {
		return {
			'SCALAR': () => '',
			'NON_NULL': (type) => type.ofType ? this._queryType(type.ofType) : '',
			'ENUM': () => '',
			'UNION': (type) => {
				type = this._getType(type.name);
				return `{ ${type.possibleTypes.reduce((query, type) => query + ` ... on ${type.name} ${this._queryType(type)} `, '')} }`;
			},
			'OBJECT': (type, only_fields) => {
				var fields = only_fields ? this._getType(type.name).fields.filter(field => only_fields.indexOf(field.name) >= 0) : this._getType(type.name).fields;
				var fieldQuery = fields.reduce(
					(query, field) => query + `${field.name} ${this._queryType(field.type)}`,
					''
				);
				return `{ ${fieldQuery} }	`;
			},
			'LIST': (type) => this._queryType(type.ofType),
		};
	}

	get _typeValidators() {
		return {
			'SCALAR': (variable) => typeof (variable) !== 'object',
			'NON_NULL': (variable) => variable !== null && variable !== undefined,
			'ENUM': (variable) => true,
			'UNION': (variable) => true,
			'OBJECT': (variable) => typeof (variable) === 'object',
			'LIST': (variable) => Array.isArray(variable),
		};
	}

	get go() {
		return (...args) => {
			return this._client(...args)
				.then(this.onData)
				.catch(this.onError);
		};
	}

	constructor(apiUrl, params) {
		this.apiUrl = apiUrl;
		this.params = params;
		this._client = client(this.apiUrl, this.params);
	}

	init(schema, queries, mutations, synced, onData, onError) {
		this.schema = schema;
		this.queries = queries;
		this.mutations = mutations;
		this.synced = synced;
		this.onData = onData;
		this.onError = onError;

		var supportedQueries = this.schema.data.__schema.types.filter(type => type.name === this.schema.data.__schema.queryType.name)[0].fields;
		this._updateApiQueries(supportedQueries);

		var supportedMutations = this.schema.data.__schema.types.filter(type => type.name === this.schema.data.__schema.mutationType.name)[0].fields;
		this._updateApiMutations(supportedMutations);

		this._updateSyncList(supportedQueries)
			.then((syncedEntities) => this.syncAll(syncedEntities));
	}

	mutate(mutation, args) {
		var m = this.mutations[mutation];
		return this.go(m.result.query, args);
	}

	query(query, args, fields, retryAmount = 0) {
		if (!this.queries[query] && this.queries.length) {
			return new Promise((resolve, reject) => {
				setTimeout(() => {
					if (retryAmount <= 1000) {
						resolve(this.query(query, args, fields, retryAmount + 1));
					} else {
						reject('Проблемы с сетью');
					}
				}, 100);
			});
		}

		try {
			var q;
			if (fields) {
				q = this.queries[query].result.queryBuilder(fields);
			} else {
				q = this.queries[query].result.query;
			}
			return this.go(q, args);
		} catch (e) {
			console.error(`Trying to query ${query}`);
		}
	}

	/**
	 * Fetches data from remote source and returns promise.
	 * 
	 * @param {object} entity object fetched using graphql introspection
	 */
	sync(entity) {
		var query = `{ ${entity.name} ${this._queryType(entity.type)} }`;
		return this.go(query, {});
	}
	
	/**
	* Shortcut function to sync a list of entities at once
	* 
	* @param {iterable} updateSyncList list of entites
	*/
	syncAll(updateSyncList) {
		if (updateSyncList.length > 0) {
			var query = `{ ${updateSyncList.reduce((query, entity) => query + ` ${entity.name} ${this._queryType(entity.type)} `, '')} }`;
			return this.go(query, {});
		}
	}

	_getType(typeName) {
		return this.schema.data.__schema.types.filter(schemaType => schemaType.name === typeName)[0];
	}

	/**
	 * Generates a query for a given type
	 * 
	 * @param type graphql type
	 */
	_queryType(type, only_fields) {
		return this._typeQueryBuilders[type.kind](type, only_fields);
	}

	/**
	 * Checks the store for entities may be synced with api.
	 * To prevent excess requests, serialized version stored in localStorage
	 * 
	 * @param {itarable} supportedQueries list of queries returned by introspection
	 * @returns promise resolving syncedEntities
	 */
	_updateSyncList(supportedQueries) {
		return new Promise((resolve, reject) => {
			resolve(supportedQueries.filter(query => query.name in this.synced));
		});
	}

	_getTypeName(type, required) {
		var name = '';
		if (type.kind === 'SCALAR') {
			name = type.name;
		} else if (type.kind === 'NON_NULL') {
			return this._getTypeName(type.ofType, true);
		} else if (type.kind === 'LIST') {
			name = `[${this._getTypeName(type.ofType)}]`;
		} else {
			name = type.name;
		}
		return `${name}${required ? '!' : ''}`
	}

	_prepareApiQuery(query, isMutation) {
		var args = query.args.map(arg => {
			return {
				name: arg.name,
				validator: this._typeValidators[arg.type.kind],
			};
		});
		var result = {
			query: `${isMutation ? 'mutation' : 'query'}${query.args.length > 0 ? `(${query.args.map(arg => `$${arg.name}:${this._getTypeName(arg.type)}`)})` : ''} {
			${query.name}${query.args.length > 0 ? `(${query.args.map(arg => `${arg.name}:$${arg.name}`)})` : ''} ${this._queryType(query.type)}
			}`,
			queryBuilder: (only_fields) => `${isMutation ? 'mutation' : 'query'}${query.args.length > 0 ? `(${query.args.map(arg => `$${arg.name}:${this._getTypeName(arg.type)}`)})` : ''} {
				${query.name}${query.args.length > 0 ? `(${query.args.map(arg => `${arg.name}:$${arg.name}`)})` : ''} ${this._queryType(query.type, only_fields)}
			}`,
			type: query.type,
		};

		return {
			args: args,
			result: result
		};
	}

	_updateApiQueries(supportedQueries) {
		var queryIndex = {};
		var queries = supportedQueries.filter(supportedQuery => this.queries.indexOf(supportedQuery.name) >= 0);

		for (var query of queries) {
			queryIndex[query.name] = this._prepareApiQuery(query);
		}
		this.queries = queryIndex;
		return supportedQueries;
	}

	_updateApiMutations(supportedMutations) {
		var mutationsIndex = {};
		var mutations = supportedMutations.filter(supportedMutation => this.mutations.indexOf(supportedMutation.name) >= 0);

		for (var mutation of mutations) {
			mutationsIndex[mutation.name] = this._prepareApiQuery(mutation, true);
		}
		this.mutations = mutationsIndex;
		return supportedMutations;
	}
}
