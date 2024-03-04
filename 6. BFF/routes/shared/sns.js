'use strict'

const axios = require('axios').default;
// const fs = require('fs');
const _ = require('lodash');

const config = require('../../config');
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(config.SENDGRID_APIKEY);
// Ref: https://docs.sendgrid.com/ui/sending-email/cross-platform-html-design - check sendgrid html guideline


function sendEmail(options) {
  return new Promise((resolve, reject) => {
    options.from = config.SENDGRID_SENDER;
    options = { subject: 'Cathay GaaS', text: 'GaaS...', ...options };  // without subject or text, sgMail will respond with 500
    options = _.pick(options, ['to', 'from', 'subject', 'text', 'html', 'attachments']);
    if (!options.html) {
      options.html = `<html><body><img src="${config.SENDGRID_LOGO}" alt="GaaS Logo" width="300px" /><hr/><p>${options.text}</p></body></html>`;
    }

    // console.log('sendEmail, options:', options);
    sgMail.send(options).then(response => {
      resolve({
        status: response[0].statusCode,
        headers: response[0].headers
      })
    }).catch(reject);
  })
}

function lineNotify(message) {
  var FormData = require('form-data');
  var data = new FormData();
  data.append('message', message);

  var conf = {
    method: 'POST',
    maxBodyLength: Infinity,
    url: config.LINE_NOTIFICATION_API,
    headers: {
      'Authorization': `Bearer ${config.LINE_NOTIFICATION_TOKEN}`,
      ...data.getHeaders()
    },
    data: data
  };

  return new Promise((resolve, reject) => {
    axios(conf).then(response => {
      resolve(response.data);
    }).catch(reject);
  })
}

module.exports = {
  /** Sends an email (directly via SendGrid-api; as opposed to using gaas-backend-sns-service) */
  sendEmail,

  /** Sends a Line notification (via Line-api / Axios; as opposed to using gaas-backend-sns-service) */
  lineNotify,

  reqEmail: (req, res) => {
    sendEmail(req.body).then(val => {
      console.log(val);
      return res.json(val).end();
    })
  },

  reqLine: (req, res) => {
    lineNotify(req.body.message).then(val => {
      console.log(val);
      return res.json(val).end();
    })
  },
};
