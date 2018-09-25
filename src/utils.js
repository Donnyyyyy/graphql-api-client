const TypeQueryBuilders = {
  SCALAR: () => '',
  NON_NULL: (schema, type, referencedObjectTypes = [], d = 0) =>
    (type.ofType ? queryType(schema, type.ofType, referencedObjectTypes, d) : ''),
  ENUM: () => '',
  UNION: (schema, type) => {
    type = getType(schema, type.name);
    return `{ ${type.possibleTypes.reduce((query, subtype) =>
      `${query} ... on ${subtype.name} ${queryType(schema, subtype)} `, '')} }`;
  },
  OBJECT: (schema, type, track = [], d = 0) => {
    track.push({
      d,
      type: type.name
    });

    const fields = getType(schema, type.name).fields;
    const fieldQuery = fields
      .filter(field => !hasSameTypeParent(track, field.type, d))
      .reduce(
        (query, field) => `${query}${field.name} ${queryType(schema, field.type, track, d + 1)}`,
        ''
      );
    return `{ ${fieldQuery} }`;
  },
  LIST: (schema, type, referencedObjectTypes = [], d = 0) => queryType(schema, type.ofType, referencedObjectTypes, d),
};

const hasSameTypeParent = (track, subtype, currentD) => track.reduce(
  (has, {
    type,
    d
  }) => has || (subtype.name === type && d < currentD),
  false
);

export const getType = (schema, typeName) => schema.data.__schema.types.filter(schemaType => schemaType.name === typeName)[0];

export const getRootQuery = (schema) => {
  const rootQueryName = schema.data.__schema.queryType.name;
  return getType(schema, rootQueryName);
};

export const getRootMutation = (schema) => {
  const rootMutationName = schema.data.__schema.mutationType.name;
  return getType(schema, rootMutationName);
};

export const getTypeName = (type, required) => {
  let name = '';
  if (type.kind === 'SCALAR') {
    name = type.name;
  } else if (type.kind === 'NON_NULL') {
    return getTypeName(type.ofType, true);
  } else if (type.kind === 'LIST') {
    name = `[${getTypeName(type.ofType)}]`;
  } else {
    name = type.name;
  }
  return `${name}${required ? '!' : ''}`;
};

export const buildArgsDef = (query, args) => `${args && Object.keys(args).length > 0
  ? `(${query.args.filter(arg => arg.name in args).map(arg => `$${arg.name}:${getTypeName(arg.type)}`)})`
  : ''}`;

export const buildArgs = (query, args) => `${args && Object.keys(args).length > 0
  ? `(${query.args.filter(arg => arg.name in args).map(arg => `${arg.name}:$${arg.name}`)})`
  : ''}`;

export const queryType = (schema, type, onlyFields, referencedObjectTypes = [], depth = 0) =>
  TypeQueryBuilders[type.kind](schema, type, onlyFields, referencedObjectTypes, depth + 1);

export const getQueryString = (schema, query, args) => `query ${buildArgsDef(query, args)} {${
  ' '}${query.name}${buildArgs(query, args)} ${queryType(schema, query.type)}${
  ' '}}`;

export const getMutationString = (schema, mutation, args) => `mutation ${buildArgsDef(mutation, args)} {${
  ' '}${mutation.name}${buildArgs(mutation, args)} ${queryType(schema, mutation.type)}${
  ' '}}`;

export const getField = (root, name) => {
  try {
    return root.fields.filter(field => field.name === name)[0];
  } catch (e) {
    throw new Error(`failed to find ${name} field`);
  }
};

export const getEnumString = (schema, enumName, value) => {
  const enumType = getType(schema, enumName);
  try {
    return enumType.enumValues.filter(enumValue => enumValue.name === value)[0].description;
  } catch (e) {
    throw new Error(`failed to find ${enumName} enum's value ${value}`);
  }
};
