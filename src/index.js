import client from './client.min';

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

	constructor({
		apiUrl = '/graphql',
		reqParams = {},
		schemaUrl = '/schema.json',
		baseQueryName = 'Query',
		baseMutationName = 'Mutation',
		onlyQueries = null,
		onlyMutations = null,
		synced = [],
		onData = () => { },
		onError = () => { }
	}) {
		this.apiUrl = apiUrl;
		this.params = reqParams;
		this.onData = onData;
		this.onError = onError;
		this._client = client(this.apiUrl, this.params);

		this._init(schemaUrl, baseQueryName, baseMutationName, onlyQueries, onlyMutations, synced);
	}

	mutate(mutationName, args) {
		const result = () => {
			try {
				return this.go(
					this.mutations[mutationName].result.queryBuilder(undefined, args),
					args
				);
			} catch (TypeError) {
				console.error(`Trying to perform mutation ${mutationName} that does not exist.`);
			}
		};
		return this.pendingInit ? this.pendingInit.then(result) : result();
	}

	query(queryName, args, fields) {
		const result = () => {
			try {
				return this.go(
					this.queries[queryName].result.queryBuilder(fields, args),
					args
				);
			} catch (TypeError) {
				console.error(`Trying to query ${queryName} that does not exist.`);
			}
		};
		return this.pendingInit ? this.pendingInit.then(result) : result();
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

	_init(schemaUrl, baseQueryName, baseMutationName, onlyQueries, onlyMutations, synced) {
		this.synced = synced;

		this.pendingInit = fetch(schemaUrl)
			.then(response => response.json())
			.then(schema => this.schema = schema)
			.then(() => {
				const baseQuery = this._getType(baseQueryName);
				const baseMutation = this._getType(baseMutationName);

				const queries = baseQuery.fields.filter(field => onlyQueries === null || onlyQueries.indexOf(field.name) >= 0);
				this.queries = this._updateApiQueries(queries);

				var mutations = baseMutation.fields.filter(field => onlyMutations === null || onlyMutations.indexOf(field.name) >= 0);
				this.mutations = this._updateApiMutations(mutations);

				this._updateSyncList(queries)
					.then((syncedEntities) => this.syncAll(syncedEntities));

				delete this.pendingInit;
			});
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
			queryBuilder: (args, only_fields) => `${isMutation ? 'mutation' : 'query'}${query.args.length > 0 ? `(${query.args.filter(arg => arg.name in args).map(arg => `$${arg.name}:${this._getTypeName(arg.type)}`)})` : ''} {
				${query.name}${query.args.length > 0 ? `(${query.args.map(arg => `${arg.name}:$${arg.name}`)})` : ''} ${this._queryType(query.type, only_fields)}
			}`,
			type: query.type,
		};

		return {
			args: args,
			result: result
		};
	}

	_updateApiQueries(queries) {
		var queryIndex = {};

		for (var query of queries) {
			queryIndex[query.name] = this._prepareApiQuery(query);
		}
		return queryIndex;
	}

	_updateApiMutations(mutations) {
		var mutationsIndex = {};

		for (var mutation of mutations) {
			mutationsIndex[mutation.name] = this._prepareApiQuery(mutation, true);
		}
		return mutationsIndex;
	}
}
