'use strict'

const express = require('express');
const app = express();
app.set('trust proxy', 'loopback');  // for GKE/ELB

app.use(require('response-time')());
app.use(require('./routes/shared').middleware);  // check JWT (and refresh if necessary); permissive - non-authoratative

require('./proxy').setupProxy(app);     // HPM proxies are configured here...
require('./app-config').setupApp(app);  // server-config, ex. compression and body-parser, etc.

// app.use('/api/sns-line', require('./routes/shared/sns').reqLine);  // temporary

// Set our api routes
const config = require('./config');
app.use((req, res, next) => {
if (config.IS_OFFLINE) {
    return res.status(418).end();
  }
  next();
})
app.get('/api/ga1', (req, res) => { res.redirect(`https://www.googletagmanager.com/gtag/js?id=${config.GA_STREAM_ID}`) })
app.get('/api/ga2', (req, res) => { res.sendFile(config.paths.gaScript); })
app.use('/api', require('./routes/api'));
app.use('/assets', express.static(config.paths.browserAssets));
app.get('*', (req, res) => { res.sendFile(config.paths.indexHtml); });

module.exports = app;