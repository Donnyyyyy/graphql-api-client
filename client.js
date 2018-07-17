var extractFiles = (a, b = []) => {
	for (var c in a) {
		var g = a[c];
		if ('object' == typeof g) {
			if ('File' === g.constructor.name) {
				a[c] = b.length;
				b.push(g);
			} else {
				b.push(...extractFiles(g));
			}
		}
	}
	return b;
},
	makeBody = (a, b, c) => {
		if (0 < c.length) {
			var g = new FormData();
			g.append('operations', `{ "query" : ${JSON.stringify(a)}, "variables": ${JSON.stringify(b)} }`), g.append('map', '{ "0": ["variables.file"] }');
			console.log(g.get('operations'));

			for (let h = 0; h < c.length; h++) g.append(h, c[h]);
			return g;
		}
		return JSON.stringify({
			query: a,
			variables: b
		});
	},
	__assign = this && this.__assign || Object.assign || function (a) {
		for (var b, c = 1, g = arguments.length; c < g; c++)
			for (var h in b = arguments[c], b) Object.prototype.hasOwnProperty.call(b, h) && (a[h] = b[h]);
		return a;
	};
export default function (a, b) {
	var c = (void 0 === b ? {} : b).headers;
	return function (h, j) {
		if ('function' != typeof fetch) throw new Error('fetch is not defined. Perhaps you need a polyfill.');
		let k = extractFiles(j);
		var l = Object.assign({
			method: 'POST',
			headers: {
				Accept: 'application/json, text/plain, */*',
				'Content-Type': 'application/json;charset=utf-8'
			},
			body: makeBody(h, j, k)
		}, b);
		return 0 < k.length && delete l.headers['Content-Type'], fetch(a, l).then(function (m) {
			return m.json();
		}).then(function (m) {
			var p = m.data,
				s = m.errors;
			return s && s.length ? Promise.reject(s[0].message) : p;
		});
	};
}