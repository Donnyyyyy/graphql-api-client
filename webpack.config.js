module.exports = {
  entry: `${__dirname}/src/index.js`,
  output: {
    path: `${__dirname}/dist`,
    filename: 'bundle.js'
  },
  module: {
    rules: [{
      test: /\.js$/,
      exclude: /node_modules/,
      use: ['babel-loader', 'source-map-loader'],
    }],
    loaders: [
      {
        test: /.js/,
        loader: 'babel',
        include: `${__dirname}/src`,
      }
    ],
  }
};
