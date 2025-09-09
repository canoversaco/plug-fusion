module.exports = {
  apps: [
    {
      name: 'plug-fusion',
      script: 'server/index.js',
      cwd: '/root/plug-fusion',
      env: {
        NODE_ENV: 'production',
        DB_DRIVER: 'sqlite',
        SQLITE_FILE: '/root/plug-fusion/data/plug_fusion.db',
        PORT: 8080
      },
      max_restarts: 10,
      restart_delay: 2000
    }
  ]
};
