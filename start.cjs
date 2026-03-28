process.env.NODE_ENV = 'production';
process.env.PORT = '3000';
process.argv = ['node', 'cli.js', './build/server/index.js'];
require('./node_modules/@react-router/serve/dist/cli.js');
