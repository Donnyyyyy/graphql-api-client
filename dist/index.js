'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }();

var _client = require('./client');

var _client2 = _interopRequireDefault(_client);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var VerboseEnum = function () {
	function VerboseEnum(id, name) {
		_classCallCheck(this, VerboseEnum);

		this.name = name;
		this._id = id;
	}

	_createClass(VerboseEnum, [{
		key: 'id',
		get: function get() {
			return this._id.substr(2, 3);
		}
	}]);

	return VerboseEnum;
}();

var GraphqlClient = function () {
	_createClass(GraphqlClient, [{
		key: '_typeQueryBuilders',
		get: function get() {
			var _this = this;

			return {
				'SCALAR': function SCALAR() {
					return '';
				},
				'NON_NULL': function NON_NULL(type) {
					return type.ofType ? _this._queryType(type.ofType) : '';
				},
				'ENUM': function ENUM() {
					return '';
				},
				'UNION': function UNION(type) {
					type = _this._getType(type.name);
					return '{ ' + type.possibleTypes.reduce(function (query, type) {
						return query + (' ... on ' + type.name + ' ' + _this._queryType(type) + ' ');
					}, '') + ' }';
				},
				'OBJECT': function OBJECT(type, only_fields) {
					var fields = only_fields ? _this._getType(type.name).fields.filter(function (field) {
						return only_fields.indexOf(field.name) >= 0;
					}) : _this._getType(type.name).fields;
					var fieldQuery = fields.reduce(function (query, field) {
						return query + (field.name + ' ' + _this._queryType(field.type));
					}, '');
					return '{ ' + fieldQuery + ' }\t';
				},
				'LIST': function LIST(type) {
					return _this._queryType(type.ofType);
				}
			};
		}
	}, {
		key: '_typeValidators',
		get: function get() {
			return {
				'SCALAR': function SCALAR(variable) {
					return (typeof variable === 'undefined' ? 'undefined' : _typeof(variable)) !== 'object';
				},
				'NON_NULL': function NON_NULL(variable) {
					return variable !== null && variable !== undefined;
				},
				'ENUM': function ENUM(variable) {
					return true;
				},
				'UNION': function UNION(variable) {
					return true;
				},
				'OBJECT': function OBJECT(variable) {
					return (typeof variable === 'undefined' ? 'undefined' : _typeof(variable)) === 'object';
				},
				'LIST': function LIST(variable) {
					return Array.isArray(variable);
				}
			};
		}
	}, {
		key: 'go',
		get: function get() {
			var _this2 = this;

			return function () {
				return _this2._client.apply(_this2, arguments).then(function (data) {
					_this2.onData(data);
					return data;
				}).catch(function (error) {
					_this2.onError(error);
					throw error;
				});
			};
		}
	}]);

	function GraphqlClient(_ref) {
		var _ref$apiUrl = _ref.apiUrl,
		    apiUrl = _ref$apiUrl === undefined ? '/graphql' : _ref$apiUrl,
		    _ref$reqParams = _ref.reqParams,
		    reqParams = _ref$reqParams === undefined ? {} : _ref$reqParams,
		    _ref$schemaUrl = _ref.schemaUrl,
		    schemaUrl = _ref$schemaUrl === undefined ? '/schema.json' : _ref$schemaUrl,
		    _ref$baseQueryName = _ref.baseQueryName,
		    baseQueryName = _ref$baseQueryName === undefined ? 'Query' : _ref$baseQueryName,
		    _ref$baseMutationName = _ref.baseMutationName,
		    baseMutationName = _ref$baseMutationName === undefined ? 'Mutation' : _ref$baseMutationName,
		    _ref$onlyQueries = _ref.onlyQueries,
		    onlyQueries = _ref$onlyQueries === undefined ? null : _ref$onlyQueries,
		    _ref$onlyMutations = _ref.onlyMutations,
		    onlyMutations = _ref$onlyMutations === undefined ? null : _ref$onlyMutations,
		    _ref$synced = _ref.synced,
		    synced = _ref$synced === undefined ? [] : _ref$synced,
		    _ref$onData = _ref.onData,
		    onData = _ref$onData === undefined ? function () {} : _ref$onData,
		    _ref$onError = _ref.onError,
		    onError = _ref$onError === undefined ? function () {} : _ref$onError;

		_classCallCheck(this, GraphqlClient);

		this.apiUrl = apiUrl;
		this.params = reqParams;
		this.onData = onData;
		this.onError = onError;
		this._client = (0, _client2.default)(this.apiUrl, this.params);

		this._init(schemaUrl, baseQueryName, baseMutationName, onlyQueries, onlyMutations, synced);
	}

	_createClass(GraphqlClient, [{
		key: 'mutate',
		value: function mutate(mutationName, args) {
			var _this3 = this;

			var result = function result() {
				var mutation = _this3.mutations[mutationName];
				if (mutation === undefined) {
					console.error('Trying to perform mutation ' + mutationName + ' that does not exist.');
				}
				return _this3.go(_this3.mutations[mutationName].result.queryBuilder(args, undefined), args);
			};
			return this.pendingInit ? this.pendingInit.then(result) : result();
		}
	}, {
		key: 'query',
		value: function query(queryName, args, fields) {
			var _this4 = this;

			var result = function result() {
				var query = _this4.queries[queryName];
				if (query === undefined) {
					console.error('Trying to perform query ' + queryName + ' that does not exist.');
				}
				return _this4.go(query.result.queryBuilder(args, fields), args).then(function (data) {
					return _this4._verbosifyQueryEnums(query.enums, data);
				});
			};
			return this.pendingInit ? this.pendingInit.then(result) : result();
		}

		/**
   * Fetches data from remote source and returns promise.
   * 
   * @param {object} entity object fetched using graphql introspection
   */

	}, {
		key: 'sync',
		value: function sync(entity) {
			var query = '{ ' + entity.name + ' ' + this._queryType(entity.type) + ' }';
			return this.go(query, {});
		}

		/**
  * Shortcut function to sync a list of entities at once
  * 
  * @param {iterable} updateSyncList list of entites
  */

	}, {
		key: 'syncAll',
		value: function syncAll(updateSyncList) {
			var _this5 = this;

			if (updateSyncList.length > 0) {
				var query = '{ ' + updateSyncList.reduce(function (query, entity) {
					return query + (' ' + entity.name + ' ' + _this5._queryType(entity.type) + ' ');
				}, '') + ' }';
				return this.go(query, {});
			}
		}
	}, {
		key: '_verbosifyQueryEnums',
		value: function _verbosifyQueryEnums(enums, result) {
			var _this6 = this;

			enums.forEach(function (enumSource) {
				return _this6._verbosifyEnumSource(enumSource.type, enumSource.path.split('.'), result);
			});
			return result;
		}
	}, {
		key: '_verbosifyEnumSource',
		value: function _verbosifyEnumSource(type, path, root) {
			var _this7 = this;

			if (path.length === 1) {
				root[path[0]] = this._verbosifyEnum(type, root[path[0]]);
			} else {
				var newRoot = root[path[0]];
				var newPath = path.splice(1);

				if (newRoot.length) {
					newRoot.forEach(function (root) {
						return _this7._verbosifyEnumSource(type, newPath.slice(), root);
					});
				} else {
					this._verbosifyEnumSource(type, newPath, newRoot);
				}
			}
		}
	}, {
		key: '_verbosifyEnum',
		value: function _verbosifyEnum(enumType, value) {
			if (!enumType.enumValues) {
				enumType = this._getType(enumType.name);
			}
			try {
				var requiredEnumItem = enumType.enumValues.filter(function (enumValue) {
					return enumValue.name === value;
				})[0];
				return new VerboseEnum(id = value, name = requiredEnumItem.description);
			} catch (e) {
				return new VerboseEnum(id = value, name = null);
			}
		}
	}, {
		key: '_init',
		value: function _init(schemaUrl, baseQueryName, baseMutationName, onlyQueries, onlyMutations, synced) {
			var _this8 = this;

			this.synced = synced;

			this.pendingInit = fetch(schemaUrl).then(function (response) {
				return response.json();
			}).then(function (schema) {
				return _this8.schema = schema;
			}).then(function () {
				var baseQuery = _this8._getType(baseQueryName);
				var baseMutation = _this8._getType(baseMutationName);

				var queries = baseQuery.fields.filter(function (field) {
					return onlyQueries === null || onlyQueries.indexOf(field.name) >= 0;
				});
				_this8.queries = _this8._updateApiQueries(queries);

				var mutations = baseMutation.fields.filter(function (field) {
					return onlyMutations === null || onlyMutations.indexOf(field.name) >= 0;
				});
				_this8.mutations = _this8._updateApiMutations(mutations);

				_this8._updateSyncList(queries).then(function (syncedEntities) {
					return _this8.syncAll(syncedEntities);
				});

				delete _this8.pendingInit;
			});
		}
	}, {
		key: '_getType',
		value: function _getType(typeName) {
			return this.schema.data.__schema.types.filter(function (schemaType) {
				return schemaType.name === typeName;
			})[0];
		}

		/**
   * Generates a query for a given type
   * 
   * @param type graphql type
   */

	}, {
		key: '_queryType',
		value: function _queryType(type, only_fields) {
			return this._typeQueryBuilders[type.kind](type, only_fields);
		}

		/**
   * Checks the store for entities may be synced with api.
   * To prevent excess requests, serialized version stored in localStorage
   * 
   * @param {itarable} supportedQueries list of queries returned by introspection
   * @returns promise resolving syncedEntities
   */

	}, {
		key: '_updateSyncList',
		value: function _updateSyncList(supportedQueries) {
			var _this9 = this;

			return new Promise(function (resolve, reject) {
				resolve(supportedQueries.filter(function (query) {
					return query.name in _this9.synced;
				}));
			});
		}
	}, {
		key: '_getTypeName',
		value: function _getTypeName(type, required) {
			var name = '';
			if (type.kind === 'SCALAR') {
				name = type.name;
			} else if (type.kind === 'NON_NULL') {
				return this._getTypeName(type.ofType, true);
			} else if (type.kind === 'LIST') {
				name = '[' + this._getTypeName(type.ofType) + ']';
			} else {
				name = type.name;
			}
			return '' + name + (required ? '!' : '');
		}
	}, {
		key: '_prepareApiQuery',
		value: function _prepareApiQuery(query, isMutation) {
			var _this10 = this;

			var args = query.args.map(function (arg) {
				return {
					name: arg.name,
					validator: _this10._typeValidators[arg.type.kind]
				};
			});
			var result = {
				queryBuilder: function queryBuilder(args, only_fields) {
					return (isMutation ? 'mutation' : 'query') + ' ' + _this10._buildArgsDef(query, args) + ' {\n\t\t\t\t' + query.name + _this10._buildArgs(query, args) + ' ' + _this10._queryType(query.type, only_fields) + '\n\t\t\t}';
				},
				type: query.type
			};

			return {
				args: args,
				result: result,
				enums: this._exploreEnums(query.type, query.name)
			};
		}
	}, {
		key: '_exploreEnums',
		value: function _exploreEnums(type) {
			var _this11 = this;

			var path = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : '';

			var interested_in = ['ENUM', 'LIST', 'OBJECT', 'NON_NULL'];

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

			return type.kind === 'ENUM' ? { path: path, type: type } : type.fields.map(function (field) {
				return _this11._exploreEnums(field.type, path + '.' + field.name);
			}).reduce(function (a, c) {
				return a.concat(c);
			});
		}
	}, {
		key: '_buildArgsDef',
		value: function _buildArgsDef(query, args) {
			var _this12 = this;

			return '' + (args && Object.keys(args).length > 0 ? '(' + query.args.filter(function (arg) {
				return arg.name in args;
			}).map(function (arg) {
				return '$' + arg.name + ':' + _this12._getTypeName(arg.type);
			}) + ')' : '');
		}
	}, {
		key: '_buildArgs',
		value: function _buildArgs(query, args) {
			return '' + (args && Object.keys(args).length > 0 ? '(' + query.args.filter(function (arg) {
				return arg.name in args;
			}).map(function (arg) {
				return arg.name + ':$' + arg.name;
			}) + ')' : '');
		}
	}, {
		key: '_updateApiQueries',
		value: function _updateApiQueries(queries) {
			var queryIndex = {};

			var _iteratorNormalCompletion = true;
			var _didIteratorError = false;
			var _iteratorError = undefined;

			try {
				for (var _iterator = queries[Symbol.iterator](), _step; !(_iteratorNormalCompletion = (_step = _iterator.next()).done); _iteratorNormalCompletion = true) {
					var query = _step.value;

					queryIndex[query.name] = this._prepareApiQuery(query);
				}
			} catch (err) {
				_didIteratorError = true;
				_iteratorError = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion && _iterator.return) {
						_iterator.return();
					}
				} finally {
					if (_didIteratorError) {
						throw _iteratorError;
					}
				}
			}

			return queryIndex;
		}
	}, {
		key: '_updateApiMutations',
		value: function _updateApiMutations(mutations) {
			var mutationsIndex = {};

			var _iteratorNormalCompletion2 = true;
			var _didIteratorError2 = false;
			var _iteratorError2 = undefined;

			try {
				for (var _iterator2 = mutations[Symbol.iterator](), _step2; !(_iteratorNormalCompletion2 = (_step2 = _iterator2.next()).done); _iteratorNormalCompletion2 = true) {
					var mutation = _step2.value;

					mutationsIndex[mutation.name] = this._prepareApiQuery(mutation, true);
				}
			} catch (err) {
				_didIteratorError2 = true;
				_iteratorError2 = err;
			} finally {
				try {
					if (!_iteratorNormalCompletion2 && _iterator2.return) {
						_iterator2.return();
					}
				} finally {
					if (_didIteratorError2) {
						throw _iteratorError2;
					}
				}
			}

			return mutationsIndex;
		}
	}]);

	return GraphqlClient;
}();

exports.default = GraphqlClient;