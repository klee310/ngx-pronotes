'use strict'

const _ = require('lodash');
const config = require('./config');
const { createProxyMiddleware } = require('http-proxy-middleware');
const sa = require('./routes/sa-lookup');


function cpm(opts={}) {
  const options = {
    target: config.IS_LOCALHOST ? config.BASE_URL : _.get(opts, 'target', config.GAAS_BACKEND_INVENTORY),
    checkAuth: _.get(opts, 'checkAuth', true),
    pathRewriteSearchValue: _.get(opts, 'pathRewriteSearchValue', '/api/backend'),
    pathRewriteReplaceValue: _.get(opts, 'pathRewriteReplaceValue', '/api/v1'),
    others: _.get(opts, 'others', {})
  }
  return createProxyMiddleware({
    changeOrigin: true,
    logLevel: 'warn',
    target: options.target,
    onProxyReq: (proxyReq, req, res) => {
      req.myOrigFQN = `${req.protocol}://${req.hostname}${req.myOrigPath}`;
      req.myOrigIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress

      if (options.checkAuth && !req.isAuthorized) {
        console.log(`[HPM] failed to access backend resource (by ${req.myOrigIp}):`, req.myOrigFQN);
        return res.status(403).end();
      }
    },
    onProxyRes: (proxyRes, req, res) => {
      const lookup = sa.lookup(proxyRes.req.path);
      const msg = `<HPM [${req.method}] ${req.myOrigFQN}${lookup ? ' ' + lookup : ''} -> ${proxyRes.req.protocol}//${proxyRes.req.host}${proxyRes.req.path} - ${proxyRes.statusCode}`;
      console.log(msg); // [GET] [200] / -> http://www.example.com
    },
    pathRewrite: (path, req) => {
      req.myOrigPath = path;
      if (config.IS_LOCALHOST) return path;
      return path.replace(options.pathRewriteSearchValue, options.pathRewriteReplaceValue);
    },
    ...options.others
  })
}

function setupProxy(app) {
  // console.log('setupProxy, debug', config.IS_LOCALHOST);
  // ex: https://gaas-sit.cathaycloudteam.net/sso/innerLogin ~~> http://gaas-backend-auth:8080/innerLogin
  app.use('/sso', cpm({target: config.GAAS_BACKEND_AUTH, checkAuth: false, pathRewriteSearchValue: '/sso', pathRewriteReplaceValue: ''}));

  app.use('/api/swagger/cfpService', cpm({target: config.GAAS_BACKEND_FOOTPRINT_SWAGGER, checkAuth: false, pathRewriteSearchValue: '/api/swagger/cfpService', pathRewriteReplaceValue: ''}));

  // ex: localhost:8080/api/backend/authService ~~> http://gaas-backend-service:8080/api/v1/auth
  app.use('/api/backend/authService', cpm({target: config.GAAS_BACKEND_INVENTORY, checkAuth: false, pathRewriteSearchValue: '/api/backend/authService', pathRewriteReplaceValue: '/api/v1/auth'}));

  // ex: localhost:8080/api/backend/cfpService ~~> http://gaas-carbon-footprint-backend-service:8080/api/v1
  app.use('/api/backend/cfpService', cpm({target: config.GAAS_BACKEND_FOOTPRINT, pathRewriteSearchValue: '/api/backend/cfpService'}));

  // // ex: localhost:8080/api/backend/invServiceOld ~~> http://gaas-backend-service:8080/api/v1
  app.use('/api/backend/invServiceOld', cpm({target: config.GAAS_BACKEND_INVENTORY_OLD, pathRewriteSearchValue: '/api/backend/invServiceOld'}));

  // ex: localhost:8080/api/backend/invService ~~> http://gaas-backend-carbon-inventory-service:8082/api/v1
  app.use('/api/backend/invService', cpm({target: config.GAAS_BACKEND_INVENTORY, pathRewriteSearchValue: '/api/backend/invService'}));

  // ex: localhost:8080/api/backend/calcService ~~> http://gaas-backend-cal-service:8080/api/v1
  app.use('/api/backend/calcService', cpm({target: config.GAAS_BACKEND_CALCULATOR, pathRewriteSearchValue: '/api/backend/calcService'}));

  // ex: localhost:8080/api/sns/ ~~> http://gaas-backend-sns-service:8080/
  app.use('/api/sns', cpm({target: config.GAAS_SNS, pathRewriteSearchValue: '/api/sns', others: {
    onProxyReq: (proxyReq, req, res) => {
      req.myOrigFQN = `${req.protocol}://${req.hostname}${req.myOrigPath}`;
      req.myOrigIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress

      // direct proxy-pass requests must be signed
      if (!req.isAuthorized) {
        console.log(`[HPM] failed to access backend resource (by ${req.myOrigIp}):`, req.myOrigFQN);
        return res.status(403).end();
      }

      // accessed available to admin-role only
      if (req.jwtx.roleId !== 1) {
        console.log(`[HPM] access-token failed (by ${req.myOrigIp}):`, req.myOrigFQN);
        return res.status(403).end();
      }
    },
  }}))
  /** to access sns-service, there are 2 methods:
   * 1) access via BFF-API - ex. https://gaas-uat.cathaycloudteam.net/api/sns/...
   * - with this method, request must be accompanied with a valid auth-header token, with roleId == 1
   *
   * or
   *
   * 2) access via GKE-DNS - ex. http://gaas-backend-sns-service:8080/api/v1/...
   * - with this method, no authentication / auth-header is required, since it is expected this is a service-to-service request
   */

  // TODO: GP2-425 DEV-BFF poke a hole for RPA
  // ex: localhost:8080/api/caas/rpa ~~> http://gaas-backend-TODO:8080/api/v1
  // app.use('/api/caas/rpa', cpm({target: config.CAAS_RPA_BACKEND, pathRewriteSearchValue: '/api/caas/rpa'}));
}

module.exports = {
  setupProxy,
  cpm
}

