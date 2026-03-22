module.exports = {
  apps: [
    {
      name: "learning-practice-web",
      cwd: __dirname,
      script: "node_modules/next/dist/bin/next",
      args: "start --hostname 127.0.0.1 --port 3001",
      env_file: ".env.production.local",
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      max_restarts: 10,
      merge_logs: true,
    },
    {
      name: "learning-practice-worker",
      cwd: __dirname,
      script: "./node_modules/.bin/tsx",
      args: "src/server/queue/worker-entry.ts",
      interpreter: "none",
      env_file: ".env.production.local",
      env: {
        NODE_ENV: "production",
      },
      autorestart: true,
      max_restarts: 10,
      merge_logs: true,
    },
  ],
};
