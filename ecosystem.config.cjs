module.exports = {
  apps: [
    {
      name: "mindbody",
      script: "node_modules/@react-router/serve/dist/cli.js",
      args: "./build/server/index.js",
      env: {
        NODE_ENV: "production",
        PORT: 3000
      }
    }
  ]
};
