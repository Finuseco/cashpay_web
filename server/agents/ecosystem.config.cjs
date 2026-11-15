const path = require("node:path");
module.exports = {
  apps: [
    {
      name: "cashpay-agent-renewals",
      cwd: path.resolve(__dirname, "../.."),
      script: "server/agents/renewal-worker.cjs",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      time: true,
      kill_timeout: 65000,
      env: { NODE_ENV: "production" },
    },
  ],
};
