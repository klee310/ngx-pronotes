'use strict'

const fs = require("fs");
const path = require('path');
const bunyan = require("bunyan");
const log = bunyan.createLogger({ name: 'gcp-storage' });
const _ = require("lodash");

const config = require("../../config");
const { SecretManagerServiceClient } = require('@google-cloud/secret-manager');
var smClient;
if (config.GCP_SA != 'null' && fs.existsSync(config.GCP_SA)) {
  smClient = new SecretManagerServiceClient({ projectId: config.GCP_PROJECT_ID, keyFilename: config.GCP_SA })
}
else {
  smClient = new SecretManagerServiceClient()
}

const tmpFolder = path.join(config.paths.serverMount, 'keys');
(function () {
  if (!fs.existsSync(tmpFolder)) {
    fs.mkdirSync(tmpFolder, { recursive: true });
  }
}());

function accessSecretVersion(resourceName) {
  return new Promise((resolve, reject) => {
    smClient.accessSecretVersion({name: resourceName}).then(val => {
      var data = _.get(_.first(val), 'payload.data');
      resolve(data.toString('utf8'));
    },
    err => {
      reject(err.message);
    })
  })
}

function downloadSecret(resourceName, destName) {
  return new Promise((resolve, reject) => {
    accessSecretVersion(resourceName).then(val => {
      var fpath = path.join(tmpFolder, destName);
      fs.writeFileSync(fpath, val.data.toString());
      resolve(fpath);
    }).catch(reject);
  })
}

module.exports = {
  accessSecretVersion,
  downloadSecret,
}
