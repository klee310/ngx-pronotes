'use strict'

const fs = require('fs');
const path = require('path');
const express = require('express');
const config = require('./config');
const compression = require('compression');
const morgan = require('morgan');  // https://github.com/expressjs/morgan
const fileUpload = require('express-fileupload');
const bodyParser = require('body-parser');

function checkStartsWith(url) {
  const prefixes = ['/assets/', '/api/carbon/query?q='];
  for (let i=0; i<prefixes.length; i++) {
    if (url.startsWith(prefixes[i])) {
      return true;
    }
  }
  return false;
}

function checkEndsWith(url) {
  const suffixes = ['.js', '.svg', '.js.map', '.css'];
  for (let i=0; i<suffixes.length; i++) {
    if (url.endsWith(suffixes[i])) {
      return true;
    }
  }
  return false;
}

function checkIncludes(url) {
  const substrings = ['/favicon.ico', '/manifest.webmanifest'];
  return substrings.includes(url);
}

function checkExactMatch(url) {
  const p = ['/', '/api/status', '/api/status/auth', '/api/ga1', '/api/ga2'];
  for (let i=0; i<p.length; i++) {
    if (url == p[i]) {
      return true;
    }
  }
  return false;
}

module.exports = {
  setupApp: (app) => {
    app.use(compression());

    app.use(morgan('short', {
      skip: function (req, res) {
        var url = req.url;
        // console.log(`[D] url: ${url}, originalUrl: ${req.originalUrl}`);
        if (checkExactMatch(req.originalUrl)) {
          return true;
        }
        if (checkStartsWith(req.originalUrl) || checkEndsWith(url) || checkIncludes(url)) {
          return true;
        }
        return false;
      }
    }));

    let tempFileDir = path.join(config.SERVER_MOUNT, 'tmp');
    if (!fs.existsSync(tempFileDir)) {
      fs.mkdirSync(tempFileDir, { recursive: true });
    }

    app.use(fileUpload({
      limits: { fileSize: 10 * 1024 * 1024 },  // 10 MB
      abortOnLimit: true, useTempFiles: true, safeFileNames: true, preserveExtension: 4,
      tempFileDir, uploadTimeout: 10000
    }))

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(express.static(config.paths.browserDist));
  }
}
