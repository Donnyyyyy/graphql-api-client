var extractFiles = (d, e = []) => {
    for (let f in d) {
      let i = d[f];
      i && typeof i == 'object' && (i.constructor.name === 'File' ? (d[f] = e.length, e.push(i)) : e.push(...extractFiles(i)));
    }
    return e;
  },
  makeBody = (d, e, f) => {
    if (f.length > 0) {
      let i = new FormData();
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
    if (typeof fetch != 'function') throw new Error('fetch is not defined. Perhaps you need a polyfill.');
    const o = extractFiles(n);
    let q = Object.assign({
      method: 'POST',
      headers: {
        Accept: 'application/json, text/plain, */*',
        'Content-Type': 'application/json;charset=utf-8',
        'Authorization': `Bearer ${localStorage.getItem('jwt')}`,
      },
      body: makeBody(i, n, o)
    }, e);
    return o.length > 0 && delete q.headers['Content-Type'], fetch(d, q).then((r) => {
      return r.json();
    }).then((r) => {
      var t = r.data,
        u = r.errors;
      return u && u.length ? Promise.reject(u[0].message) : t;
    });
  };
}
