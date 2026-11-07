const path = require("node:path");
module.exports = {
  apps: [
    {
      name: "cashpay-loan-repayments",
      cwd: path.resolve(__dirname, "../.."),
      script: "server/loans/repayment-worker.cjs",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      time: true,
      kill_timeout: 65000,
      env: { NODE_ENV: "production" },
    },
  ],
};
