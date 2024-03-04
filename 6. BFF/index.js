'use strict'

const app = require('./app');
const config = require('./config');

const http = require('http');
const server = http.createServer(app);

const adminNotifyMsg = `(${config.SERVER_IMG}): UP, \nBASE_URL: ${config.BASE_URL}`;
if (config.IS_LOCALHOST) {
  console.log(`[D] line-notify: ${adminNotifyMsg}`)
}
else {
  const sns = require('./routes/shared/sns');
  sns.lineNotify(adminNotifyMsg);
}

server.listen(config.SERVER_PORT, config.SERVER_HOST, () => {
  console.log(`<< Frontend >> ${config.SERVER_HOST}:${config.SERVER_PORT}`);
  console.log(JSON.stringify(require('./routes/shared/status').getBasicStatus(), null, 2));
  console.log('>>\n');
});

