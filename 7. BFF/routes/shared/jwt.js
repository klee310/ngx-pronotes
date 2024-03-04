'use strict'

const config = require('../../config');
const jwt = require('jsonwebtoken');
const _ = require('lodash');

module.exports = {

  /** Returns the decoded payload without verifying if the signature is valid */
  decode: (token) => {
    return jwt.decode(token);
  },

  /** Returns the Object representation for the specified otp if it is valid; otherwise null is returned; checkExpiry defaults true */
  verifyOtp: (otp, checkExpiry=true) => {
    try {
      if (checkExpiry) {
        return jwt.verify(otp, config.getJwtSecret(), { algorithms: 'HS256' });
      }
      else {
        return jwt.verify(otp, config.getJwtSecret(), { algorithms: 'HS256', ignoreExpiration: true });
      }
    }
    catch {
      return null;
    }
  },

  getSignature: (otp) => {
    return otp.split('.')[2];
  },

  /** Returns an OTP containing the specified email and pass as data; expires in 1h */
  createOtp: (email, pass) => {
    return jwt.sign({ pass }, config.getJwtSecret(), { issuer: config.jwtIssuer, subject: email, expiresIn: '1h' });
  },

  /** Returns a regular JWT with config.expiry */
  createToken: (email, data={}) => {
    return jwt.sign(data, config.getJwtSecret(), { issuer: config.jwtIssuer, expiresIn: config.jwtExpiry });
  },

  /** Returns an extended JWT with crazy expiry - used by localhost / admin only */
  createTokenEx: (email, data={}) => {
    return jwt.sign(data, config.getJwtSecret(), { issuer: config.jwtIssuer, expiresIn: '100d' });
  },

  /** Returns a regular JWT with config.expiry, using email from oldToken as subject */
  createRefreshToken: (oldToken, data={}) => {
    var _data = {...data};
    _.merge(_data, _.omit(oldToken, ['iat', 'exp']));
    return jwt.sign(_data, config.getJwtSecret(), { expiresIn: config.jwtExpiry });
  },

  sign: (data, exp) => {
    return jwt.sign({...data}, config.getJwtSecret(), { expiresIn: exp ? exp : config.jwtExpiry });
  }
}
