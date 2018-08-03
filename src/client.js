var extractFiles = (d, e = []) => {
	for (var f in d) {
		var i = d[f];
		i && 'object' == typeof i && ('File' === i.constructor.name ? (d[f] = e.length, e.push(i)) : e.push(...extractFiles(i)));
	}
	return e
},
	makeBody = (d, e, f) => {
		if (0 < f.length) {
			var i = new FormData();
			i.append('operations', `{ "query" : ${JSON.stringify(d)}, "variables": ${JSON.stringify(e)} }`);
			i.append('map', '{ "0": ["variables.file"] }');
			for (let n = 0; n < f.length; n++) i.append(n, f[n]);
			return i;
		}
		return JSON.stringify({
			query: d,
			variables: e
		});
	};
export default function (d, e) {
	return function (i, n) {
		if ('function' != typeof fetch) throw new Error('fetch is not defined. Perhaps you need a polyfill.');
		let o = extractFiles(n);
		var q = Object.assign({
			method: 'POST',
			headers: {
				Accept: 'application/json, text/plain, */*',
				'Content-Type': 'application/json;charset=utf-8'
			},
			body: makeBody(i, n, o)
		}, e);
		return 0 < o.length && delete q.headers['Content-Type'], fetch(d, q).then(function (r) {
			const reader = r.body.getReader();
			return reader.read().then(({ value }) => {
				try {
					value = JSON.parse(new TextDecoder("utf-8").decode(value));
					return value;
				} catch (e) {
					console.log(e);
					return {};
				}
			});
			
			return r.json();
		}).then(function (r) {
			var t = r.data,
				u = r.errors;
			return u && u.length ? Promise.reject(u[0].message) : t;
		});
	};
}