'use strict'

const express = require('express');
const router = express.Router();
const _ = require('lodash');
const axios = require("axios").default;
const config = require("../config");
const sa = require('./sa-lookup');

function getHref(url, params) {
  const result = new URL(url);
  _.forEach(params, (v, k) => {
    result.searchParams.append(k, v);
  })
  return decodeURI(result.href);
}
// setup axios intercepters (middleware)
axios.interceptors.request.use(req => {
  if (!!req.jwt && !req.headers.Authorization) {
    req.headers.Authorization = `Bearer ${req.jwt}`;
    if (config.IS_LOCALHOST) {
      req.headers.timeout = 10000;
    }
  }
  const url = (req.params) ? getHref(req.url, req.params) : req.url;
  console.log(`>> BE [${req.method.toUpperCase()}] ${url} ${sa.lookup(url)}`);
  return req;
}, null, {synchronous: true});
axios.interceptors.response.use(
  res => {
    console.log(`<< BE [${res.config.method.toUpperCase()}] ${res.config.url} - ${res.status} - ${res.statusText} - ${_.get(res.headers, 'content-type', 'n/a')} - ${(_.get(res.headers, 'content-type') == 'application/json') ? JSON.stringify(res.data).length : '?'} - ${_.get(res.headers, 'x-response-time', '')}`);
    return res;
  },
  err => {
    console.log(`<! BE [${err.request?.method}] ${err.config.url} - - ${err.message}`);
    throw err;
  },
  {synchronous: true}
);


// unauthenticated
router.use('/home', require('./home'));             // api/home
router.use('/auth', require('./auth'));             // api/auth
router.use('/status', require('./shared/status').router);  // api/status

// routes below require authentication token
router.use((req, res, next) => {
  if (req.isAuthorized) {
    next();
  }
  else {
    console.log('session expired:', _.get(req.jwtx, 'sub', req.ip));
    res.removeHeader('authorization');
    res.status(403).end();
  }
})
router.use('/users', require('./users'));     // api/users
...
router.get('', (req, res) => {  // generic fallback
  res.status(403).end();
});

module.exports = router;
