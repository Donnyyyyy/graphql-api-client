import { WebSocketBridge } from 'django-channels';

import client from './client';


class VerboseEnum {
	constructor(id, name) {
		this._id = id;
		this.name = name;
		this.id = this._id ? this._id.substr(2) : null;
	}

	get getId() {
		return this._id.substr(2);
	}

	retrieveId() {
		return this._id.substr(2);
	}
}


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
		verbose=false,
	}) {
		this.verbose = verbose;
		this.apiUrl = apiUrl;
		this.params = reqParams;
		this.onData = onData;
		this.onError = onError;
		this._client = client(this.apiUrl, this.params);

		this._initWsClient(wsApiUrl, wsStreamName);
		this._init(schemaUrl, baseQueryName, baseMutationName, onlyQueries, onlyMutations, synced);
	}

	_initWsClient(wsApiUrl, wsStreamName) {
		if (!wsApiUrl) {
			return;
		}
		this._wsStreamName = wsStreamName;
		this._wsHandlers = {};

		this._wsclient = new WebSocketBridge();
		this._wsclient.connect(wsApiUrl);
		this._wsclient.listen();

		this._wsclient.demultiplex(this._wsStreamName, (action, stream) => {
			if (this.verbose) {
				console.debug(action);
			}
			try {
				const data = JSON.parse(action).data;
				for (let action in data) {
					const handler = this._wsHandlers[action];
					if (handler) {
						handler(data[action]);
					} else if (this.verbose) {
						console.debug(`Unhandled ${action} action`);
					}
				}
			} catch (e) {
				console.log(e);
				
				return;
			}
		});
	}

	queryWs(queryName, args = {}, fields = null) {
		const query = this.queries[queryName];
		if (query === undefined) {
			console.error(`Trying to perform query ${queryName} that does not exist.`);
		}
		this._actionWs(query, args, fields);
	}

	mutateWs(mutationName, args) {
		const mutation = this.mutations[mutationName];
		if (mutation === undefined) {
			console.error(`Trying to perform mutation ${mutationName} that does not exist.`);
		}
		this._actionWs(mutation, args, fields);
	}

	_actionWs(action, args = {}, fields = null) {
		const result = () => {
			this._wsclient.stream(this._wsStreamName).send({
				query: action.result.queryBuilder(args, fields),
				variables: JSON.stringify(args),
			});
		};
		return this.pendingInit ? this.pendingInit.then(result) : result();
	}

	addWsHandler(query, handler) {
		if (!this._wsclient) {
			throw Error('No ws client aviable');
		}
		this._wsHandlers[query] = handler;
	}

	mutate(mutationName, args) {
		const result = () => {
			const mutation = this.mutations[mutationName];
			if (mutation === undefined) {
				console.error(`Trying to perform mutation ${mutationName} that does not exist.`);
			}
			return this.go(
				this.mutations[mutationName].result.queryBuilder(args, undefined),
				args
			);
		};
		return this.pendingInit ? this.pendingInit.then(result) : result();
	}

	query(queryName, args, fields) {
		const result = () => {
			const query = this.queries[queryName];
			if (query === undefined) {
				console.error(`Trying to perform query ${queryName} that does not exist.`);
			}
			return this.go(
				query.result.queryBuilder(args, fields),
				args
			).then(data => this._verbosifyQueryEnums(query.enums, data));
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

	_verbosifyQueryEnums(enums, result) {
		enums.forEach(enumSource => this._verbosifyEnumSource(enumSource.type, enumSource.path.split('.'), result));
		return result;
	}

	_verbosifyEnumSource(type, path, root) {
		if (path.length === 1) {
			root[path[0]] = this._verbosifyEnum(type, root[path[0]]);
		} else {
			const newRoot = root[path[0]];
			const newPath = path.splice(1);

			if (!newRoot) {
				return;
			}

			if (newRoot.length) {
				newRoot.forEach(root => this._verbosifyEnumSource(type, newPath.slice(), root));
			} else {
				this._verbosifyEnumSource(type, newPath, newRoot);
			}
		}
	}

	_verbosifyEnum(enumType, value) {
		if (!enumType.enumValues) {
			enumType = this._getType(enumType.name);
		}
		try {
			const requiredEnumItem = enumType.enumValues.filter(enumValue => enumValue.name === value)[0];
			const result = new VerboseEnum(value, requiredEnumItem.description);
			return result;
		} catch (e) {
			return new VerboseEnum(value, null);
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
			queryBuilder: (args, only_fields) => `${isMutation ? 'mutation' : 'query'} ${this._buildArgsDef(query, args)} {
				${query.name}${this._buildArgs(query, args)} ${this._queryType(query.type, only_fields)}
			}`,
			type: query.type,
		};

		return {
			args: args,
			result: result,
			enums: this._exploreEnums(query.type, query.name),
		};
	}

	_exploreEnums(type, path = '') {
		const interested_in = ['ENUM', 'LIST', 'OBJECT', 'NON_NULL',];

		if (interested_in.indexOf(type.kind) < 0) {
			return [];
		}

		if (type.kind === 'OBJECT' && type.fields === undefined) {
			type = this._getType(type.name);
		} else if (type.kind === 'LIST') {
			return this._exploreEnums(type.ofType, path);
		} else if (type.kind === 'NON_NULL') {
			return this._exploreEnums(type.ofType, path);
		}

		return type.kind === 'ENUM' ? { path, type } : type.fields.map(field => this._exploreEnums(field.type, `${path}.${field.name}`)).reduce((a, c) => a.concat(c));
	}

	_buildArgsDef(query, args) {
		return `${args && Object.keys(args).length > 0 ? `(${query.args.filter(arg => arg.name in args).map(arg => `$${arg.name}:${this._getTypeName(arg.type)}`)})` : ''}`;
	}

	_buildArgs(query, args) {
		return `${args && Object.keys(args).length > 0 ? `(${query.args.filter(arg => arg.name in args).map(arg => `${arg.name}:$${arg.name}`)})` : ''}`;
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
