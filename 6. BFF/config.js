const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
const _ = require('lodash');
const fs = require('fs');
const path = require('path');

// below - these items should be automatically configured either through CI/CD or manually on deployment
const SERVER_IMG = process.env.SERVER_IMG || 'localhost';
const IS_LOCALHOST = (!process.env.SERVER_IMG || process.env.SERVER_IMG == 'localhost');

// below - these items can be configured by Operations-team at anytime to tweak application behavior
const ENABLE_SSO_MOCK = process.env.ENABLE_SSO_MOCK || false;  // only for SIT, configure environment-variable ENABLE_SSO_MOCK = '1' (to use fake sso-login method)
const IS_OFFLINE = process.env.IS_OFFLINE || false;  // set to true to enable maintenance-mode; key routes such as /api/users/roles will return 418 triggering UI to show in-maintenance page
const GCP_SA = process.env.GCP_SA || path.join(__dirname, './server-mount/keys/....json');

// below (IMPORTANT!!!) - these items should be configured by Operations-team / DevOps either in GKE deployment.yaml or manually on deployment...
const BASE_URL = process.env.BASE_URL || 'https://....net';
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || '...';
const GCP_STORAGE_BUCKET_NAME = process.env.GCP_STORAGE_BUCKET_NAME || '...';
const SM_RESOURCE_BASE = process.env.SM_RESOURCE_BASE || 'projects/.../secrets';  // secret-manager resource-name prefix
const SM_JWT_SECRET_PATH = process.env.SM_JWT_SECRET_PATH || `${SM_RESOURCE_BASE}/jwt-secret-key/versions/latest`;  // if SM_JWT_SECRET_PATH env-var is defined, then SM_RESOURCE_BASE is ignored
const GA_STREAM_ID = process.env.GA_STREAM_ID || '...';

// below - these items are hard-coded, shouldn't be touched unless you know what you're doing...
const paths = {
  browserDist: path.join(__dirname, '../dist/web-app'),
  browserAssets: path.join(__dirname, '../dist/web-app/assets'),
  indexHtml: path.join(__dirname, '../dist/web-app/index.html'),
  mockdata: path.join(__dirname, 'mockdata'),
  serverMount: path.join(__dirname, 'server-mount'),
  gaScript: path.join(__dirname, 'server-mount/ga-script.js'),
};

let SM_JWT_SECRET = '...';  // should be overwritten by value in SM
function getJwtSecret() { return process.env.JWT_SECRET || SM_JWT_SECRET; }

const ENV_KEY = (IS_LOCALHOST) ? 'localhost' : BASE_URL.includes('https://...') ? 'sit' : BASE_URL.includes('https://...') ? 'uat' : 'prod';
function setupSecretManagerData() {
  return new Promise((resolve) => {
    if (IS_LOCALHOST) {
      console.log('[D] (localhost) using hardcoded jwt-secret:', SM_JWT_SECRET);
      return resolve(false);
    }

    // instead of using function from shared/sm.js - we're (almost) duplicating the code here to avoid circular reference
    var smClient;
    if (GCP_SA != 'null' && fs.existsSync(GCP_SA)) {
      smClient = new SecretManagerServiceClient({ projectId: GCP_PROJECT_ID, keyFilename: GCP_SA })
    }
    else {  // uses current process/service's workload-identity
      smClient = new SecretManagerServiceClient()
    }
    smClient.accessSecretVersion({name: SM_JWT_SECRET_PATH}).then(val => {
      SM_JWT_SECRET = _.get(_.first(val), 'payload.data').toString('utf8');
      console.log('smClient successfully configured jwt-secret');
      return resolve(true);
    }).catch(error => {
      // console.log(error.message || error);
      if (ENV_KEY == 'sit' || ENV_KEY == 'uat') {
        console.log('WARNING! smClient failed to retrieve jwt-secret, reverting to default. Try configuring environment-variable: "SM_RESOURCE_BASE" or "SM_JWT_SECRET_PATH"');
        console.log('  SM_RESOURCE_BASE currently configured as:', SM_RESOURCE_BASE)
        console.log('SM_JWT_SECRET_PATH currently configured as:', SM_JWT_SECRET_PATH)
      }
      if (ENV_KEY == 'prod') {
        throw(error);  // crash the service - since this is essentially a critical-issue, requiring Ops/DevOps intervention
      }
      return resolve(false);
    })
    // TODO: add other secrets here, such as: SendGrid-api-key, Line-notification-api-token, etc.
  })
}

// this is the last function in this file... do not put anything else after this function (except module.exports); this function is invoked automatically when this config-module is imported
(() => {
  setupSecretManagerData();

  if (!fs.existsSync(paths.serverMount)) {
    fs.mkdirSync(paths.serverMount, { recursive: true });
  }
  if (!fs.existsSync(path.join(paths.gaScript))) {
    // prepare 2nd google-analytic script using template-file, string-replacing with configured GA Stream-Id
    let temp = fs.readFileSync(path.join(__dirname, 'routes/shared/gaScript.temp.js'));
    temp = _.replace(temp, 'G-???', GA_STREAM_ID);
    fs.writeFileSync(path.join(paths.gaScript), temp);
  }
})();


module.exports = {
  startEpoch: require('moment').now(),
  paths,
  setupSecretManagerData,
  getJwtSecret,
  jwtIssuer: process.env.JWT_ISSUER || '...',  // inconsequential... can be anything, this is the way...
  jwtExpiry: process.env.JWT_EXPIRY || '12h',  // session-token expiry
  jwtRefreshMin: process.env.JWT_REFRESH_MIN || 5 * 60,  // if current time is this number of seconds or greater past issue-time, then a new token will be generated on next client-request (provided the token is not expired)
  dataMount: process.env.SERVER_MOUNT || paths.mockdata,
  ENABLE_SSO_MOCK,

  GCP_SA,
  GCP_PROJECT_ID,
  GCP_STORAGE_BUCKET_NAME,

  // sendGrid
  SENDGRID_APIKEY: process.env.SENDGRID_APIKEY || '...',
  SENDGRID_SENDER: process.env.SENDGRID_SENDER || '...@..com.tw',
  SENDGRID_LOGO: process.env.SENDGRID_LOGO || '...',

  // Line notification (for errors)
  LINE_NOTIFICATION_API: process.env.LINE_NOTIFICATION_API || 'https://notify-api.line.me/api/notify',
  LINE_NOTIFICATION_TOKEN: process.env.LINE_NOTIFICATION_TOKEN || '...',

  BASE_URL,
  GAAS_BACKEND_AUTH: process.env.GAAS_BACKEND_AUTH || 'http://...-service:8080',
  /** (default) http://gaas-backend-service:8080 */
  GAAS_BACKEND_INVENTORY: process.env.GAAS_BACKEND_INVENTORY || 'http://gaas-backend-carbon-inventory-service:8082',
  GAAS_BACKEND_INVENTORY_OLD: process.env.GAAS_BACKEND_INVENTORY_OLD || 'http://gaas-backend-service:8080',
  // GAAS_BACKEND_INVENTORY2: process.env.GAAS_BACKEND_INVENTORY2 || 'http://gaas-backend-carbon-inventory-service:8082',
  /** (default) http://gaas-backend-cf-service:8080 */
  GAAS_BACKEND_FOOTPRINT: process.env.GAAS_BACKEND_FOOTPRINT || 'http://gaas-backend-cf-service:8080',
  GAAS_BACKEND_FOOTPRINT_SWAGGER: process.env.GAAS_BACKEND_FOOTPRINT_SWAGGER || 'http://gaas-backend-cf-service:8080',
  GAAS_BACKEND_CALCULATOR: process.env.GAAS_BACKEND_CALCULATOR || 'http://gaas-backend-cal-service:8080',
  GAAS_COMMON: process.env.GAAS_COMMON || 'http://gaas-common-service:8081',
  GAAS_SNS: process.env.GAAS_SNS || 'http://gaas-backend-sns-service:8080',
  CAAS_RPA_BACKEND: process.env.CAAS_RPA_BACKEND || 'http://gaas-backend-TODO:8080',

  GA_STREAM_ID,
  SERVER_IMG,
  SERVER_MOUNT: process.env.SERVER_MOUNT || paths.serverMount,
  SERVER_HOST: process.env.SERVER_HOST || '0.0.0.0',
  SERVER_PORT: process.env.SERVER_PORT || 8080,
  /** determined by environment-variable SERVER_IMG */
  IS_LOCALHOST,
  IS_OFFLINE,
  ENV_KEY
}
