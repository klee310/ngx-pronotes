'use strict'

const fs = require("fs");
const path = require('path');
const bunyan = require("bunyan");
const log = bunyan.createLogger({ name: 'gcp-storage' });
const _ = require("lodash");

const config = require("../../config");
const { Storage } = require('@google-cloud/storage');
var storage;
if (config.GCP_SA != 'null' && fs.existsSync(config.GCP_SA)) {
  storage = new Storage({ projectId: config.GCP_PROJECT_ID, keyFilename: config.GCP_SA });
}
else {
  storage = new Storage({ projectId: config.GCP_PROJECT_ID });
}

const tmpFolder = path.join(config.paths.serverMount, 'tmp');
(function () {
  if (!fs.existsSync(tmpFolder)) {
    fs.mkdirSync(tmpFolder, { recursive: true });
  }
}());

module.exports = {
  listBuckets: () => {
    return new Promise((resolve, reject) => {
      storage.getBuckets().then(val => {
        var temp = [];
        _.forEach(val[0], v => {
          temp.push({ name: v.name, id: v.id });
        })
        resolve(temp);
      }).catch(reject);
    })
  },

  uploadFile: (filePath, destFileName = '') => {
    return new Promise((resolve, reject) => {
      var destName = destFileName;
      if (!destName) {
        destName = path.basename(filePath);
      }
      storage.bucket(config.GCP_STORAGE_BUCKET_NAME).upload(filePath, { destination: destName })
        .then(() => {
          resolve({ filePath, bucket: config.GCP_STORAGE_BUCKET_NAME, destination: destName });
        })
        .catch(reject);
    })
  },

  listFiles: () => {
    return new Promise((resolve, reject) => {
      storage.bucket(config.GCP_STORAGE_BUCKET_NAME).getFiles().then(val => {
        resolve(_.map(_.map(_.first(val), v => v.metadata), m => _.pick(m, ['name', 'size', 'md5Hash', 'crc32c', 'timeCreated'])));
      }).catch(reject);
    })
  },

  downloadFile: (filename) => {
    return new Promise((resolve, reject) => {
      const _filename = _.last(_.split(filename, '/'));
      const destPath = path.join(tmpFolder, _filename);

      if (config.IS_LOCALHOST) {
        console.log(`[D] CloudStorage Download from bucket: ${config.GCP_STORAGE_BUCKET_NAME}, filename: ${filename}, destination: ${destPath}`);
      }
      storage.bucket(config.GCP_STORAGE_BUCKET_NAME).file(filename).download({ destination: destPath }, (error) => {
        if (!!error) {
          reject(error);
        }
        resolve(destPath);
      })
    })
  },

  downloadGsUri: (uri) => {
    return new Promise((resolve, reject) => {
      // assumes uri string is strictly formatted
      var regex = /^gs:\/\/([^\/]+)\/(.*)$/;
      // var match = regex.exec(uri);
      var match = regex.exec(decodeURI(uri));

      const bucketName = match[1];
      const filepath = match[2];
      const filename = _.last(_.split(filepath, '/'));
      const destPath = path.join(tmpFolder, filename);
      if (config.IS_LOCALHOST) {
        console.log(`[D] CloudStorage Download ${uri}`, {bucketName, filepath, filename, destPath});
      }

      storage.bucket(bucketName).file(filepath).download({ destination: destPath }, (error) => {
        if (!!error) {
          reject(error);
        }
        resolve(destPath);
      })
    })
  }
}
