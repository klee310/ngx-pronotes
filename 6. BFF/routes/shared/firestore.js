'use strict'

const fs = require('fs');
const _ = require('lodash');
const config = require('../../config');
const ordered = require('./ordered');
const Firestore = require('@google-cloud/firestore');

var db;
if (!!config.GCP_SA && fs.existsSync(config.GCP_SA)) {
  db = new Firestore({ projectId: config.GCP_PROJECT_ID, keyFilename: config.GCP_SA });
}
else {
  db = new Firestore({ projectId: config.GCP_PROJECT_ID });
}

module.exports = {
  /**
   * @summary the authenticated Firestore object-reference
   */
  db,

  // batch write a list of data-objects into the specified collection
  /**
   * @param {string} collectionName target Firestore collection
   * @param {[object]} dataArray an array of objects
   * @summary Batch-create documents in the specified collection
   */
  batch: (collectionName, dataArray) => {
    return new Promise((resolve, reject) => {
      const collection = db.collection(collectionName);
      const result = []

      _.forEach(dataArray, d => {
        var doc = collection.doc();
        // _.set(d, '_meta.id', doc.id);
        // _.set(d, '_meta.created', Math.round(Date.now() / 1000));
        _.set(d, '_id', doc.id);
        result.push([doc.set(d), doc.id]);
      })

      Promise.all(result.map(r => r[0])).then(val => {
        resolve(result.map(r => r[1]));
      }).catch(reject)
    });
  },

  // insert the specified data into the specified collection
  /**
   *
   * @param {string} collectionName target Firestore collection
   * @param {object} data source object to insert
   * @returns Promise
   * @summary Insert the source data object into the target Firestore collection. A new document is always created
   */
  insert: (collectionName, data) => {
    return new Promise((resolve, reject) => {
      const collection = db.collection(collectionName);

      const doc = collection.doc();
      // _.set(data, '_meta.id', doc.id);
      // _.set(data, '_meta.created', Math.round(Date.now() / 1000));
      _.set(data, '_id', doc.id);
      doc.set(data).then(val => {
        resolve(doc.id);
      }).catch(reject)
    })
  },

  /**
   *
   * @param {string} collectionName target Firestore collection
   * @param {object} data source object to insert
   * @param  {string} conditions query conditions to perform, to find the existing document to be updated; ex. ['ticketId', '==', 'CLI-101']
   * @returns Promise
   * @summary Update an existing document based on conditions. If the query condition does not return an existing document, a new document is created. When merging with existing document, fields are overwritten if already exist - fields that do not exist in source document are untouched
   */
  update: (collectionName, data, conditions) => {
    const collection = db.collection(collectionName);

    function create(resolve, reject) {
      const doc = collection.doc();
      // _.set(data, '_meta.id', doc.id);
      // _.set(data, '_meta.created', Math.round(Date.now() / 1000));
      _.set(data, '_id', doc.id);
      doc.set(data).then(val => {
        resolve(doc.id);
      }).catch(reject)
    }

    function update(ids, resolve, reject) {
      // _.set(data, '_meta.modified', Math.round(Date.now() / 1000));
      const results = [];
      _.forEach(ids, t => {
        results.push(db.doc(`${collectionName}/${t}`).set(data, { merge: true }));
      })

      Promise.all(results).then(val => { resolve(ids); }).catch(error => { reject(error); })
    }

    return new Promise((resolve, reject) => {
      if (!conditions || conditions.length != 3) {
        create(resolve, reject);
      }
      else {
        collection.where(...conditions).get().then(val => {
          const ids = [];
          val.docs.map(v => ids.push(v.id));

          if (!ids.length) { create(resolve, reject); }
          else { update(ids, resolve, reject); }
        })
      }
    })
  },

  updateById: (collectionName, id, data) => {
    return new Promise(async (resolve, reject) => {
      try {
        await db.doc(`${collectionName}/${id}`).set(data, { merge: true });
        resolve(id);
      }
      catch (error) {
        reject(error);
      }
    })
  },

  findById: (collectionName, id) => {
    return new Promise(async (resolve, reject) => {
      try {
        var result = await db.doc(`${collectionName}/${id}`).get();
        result = result.data();
        // console.log(result);
        resolve (result);
      }
      catch (error) {
        reject(error);
      }
    })
  },

  /**
   *
   * @param {string} collectionName target Firestore collection
   * @param  {...string} conditions query conditions to perform, to find the existing document to be updated; ex. ['env', '==', 'UAT']
   * @returns Promise
   * @summary Returns the result of the query-search on the target collection. If no results are found, an empty object {} is returned. If only 1 result is found, the object {...} is returned. And if more than 1 result is found, an array containing all the objects are returned [{...}, {...}, ...]
   */
  find: (collectionName, conditions) => {
    return new Promise((resolve, reject) => {
      const collection = db.collection(collectionName);

      collection.where(...conditions).get().then(val => {
        const temp = [];
        val.docs.map(v => {
          var data = v.data();
          _.merge(data, {
            '_meta': {
              id: v.id,
              created: v.createTime._seconds,
              modified: v.updateTime._seconds
            }
          })
          temp.push(ordered(data));
        })
        if (temp.length == 0) { resolve({}); }
        else if (temp.length == 1) { resolve(temp[0]); }
        else { resolve(temp); }
      }).catch(reject)
    })
  },

  /**
   *
   * @param {string} collectionName target Firestore collection
   * @returns Promise
   * @summary Returns the list of objects contained in the specified collection
   */
  getAll: (collectionName) => {
    return new Promise((resolve, reject) => {
      const collection = db.collection(collectionName);

      collection.get().then(val => {
        const temp = []
        val.docs.map(v => {
          var data = v.data();
          _.merge(data, {
            '_meta': {
              id: v.id,
              created: v.createTime._seconds,
              modified: v.updateTime._seconds
            }
          })
          temp.push(ordered(data));
        })
        resolve(temp);
      }).catch(reject)
    })
  },

  delete: (collectionName, conditions) => {
    return new Promise((resolve, reject) => {
      const collection = db.collection(collectionName);
      collection.where(...conditions).get().then(val => {
        var id = val.docs[0].data()._meta.id;
        collection.doc(id).delete().then(val => {
          var temp = { delete: id, result: val }
          console.log(temp);
          resolve(temp);
        }).catch(reject);
      }).catch(reject);
    })
  }
}
