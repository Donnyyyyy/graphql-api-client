'use strict';

Object.defineProperty(exports, "__esModule", {
	value: true
});

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

exports.default = function (d, e) {
	return function (i, n) {
		if ('function' != typeof fetch) throw new Error('fetch is not defined. Perhaps you need a polyfill.');
		var o = extractFiles(n);
		var q = Object.assign({
			method: 'POST',
			headers: {
				Accept: 'application/json, text/plain, */*',
				'Content-Type': 'application/json;charset=utf-8'
			},
			body: makeBody(i, n, o)
		}, e);
		return 0 < o.length && delete q.headers['Content-Type'], fetch(d, q).then(function (r) {
			return r.json();
		}).then(function (r) {
			var t = r.data,
			    u = r.errors;
			return u && u.length ? Promise.reject(u[0].message) : t;
		});
	};
};

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var extractFiles = function extractFiles(d) {
	var e = arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : [];

	for (var f in d) {
		var i = d[f];
		i && 'object' == (typeof i === 'undefined' ? 'undefined' : _typeof(i)) && ('File' === i.constructor.name ? (d[f] = e.length, e.push(i)) : e.push.apply(e, _toConsumableArray(extractFiles(i))));
	}
	return e;
},
    makeBody = function makeBody(d, e, f) {
	if (0 < f.length) {
		var i = new FormData();
		i.append('operations', '{ "query" : ' + JSON.stringify(d) + ', "variables": ' + JSON.stringify(e) + ' }');
		i.append('map', '{ "0": ["variables.file"] }');
		for (var n = 0; n < f.length; n++) {
			i.append(n, f[n]);
		}return i;
	}
	return JSON.stringify({
		query: d,
		variables: e
	});
};