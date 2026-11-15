const path = require('path');
// This WebRTC mesh keeps room membership in memory: run one shared signaling process.
module.exports = {
  apps: [{
    name: 'cashpay-realtime',
    cwd: path.resolve(__dirname, '../..'),
    script: 'server/onchat/ws-server.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    env: { ONCHAT_WS_HOST: '127.0.0.1', ONCHAT_WS_PORT: '3101' },
  }],
};
