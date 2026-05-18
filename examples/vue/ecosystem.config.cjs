module.exports = {
  apps: [
    {
      name: 'vike-islands-vue',
      script: 'node_modules/vite/bin/vite.js',
      args: 'preview',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
}
