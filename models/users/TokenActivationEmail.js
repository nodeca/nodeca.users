/**
 *  class models.users.TokenActivationEmail
 *
 *  Expirable secret key used for email address confirmation by newly
 *  registered users.
 **/


'use strict';


const BigNumber   = require('bignumber.js');
const Mongoose    = require('mongoose');
const Schema      = Mongoose.Schema;
const createToken = require('nodeca.core/lib/app/random_token');

const TOKEN_EXPIRE_TIMEOUT    = 30 * 60; // 30 minutes in seconds

function createDecimalToken() {
  // convert to decimal because it's easier for user to type, get last 30
  // digits because first few digits don't have uniform distribution
  return new BigNumber('0x' + createToken()).toString(10).slice(-30);
}


module.exports = function (N, collectionName) {

  let TokenActivationEmail = new Schema({
    secret_key:   { type: String, default: createDecimalToken },
    // short code is used if user opens email link on another device,
    // so we already have enough level of confidence that login is legitimate
    short_code:   String,
    // time when code was generated (code has shorter timeout)
    open_link_ts: Date,
    attempts:     { type: Number, default: 0 },
    create_ts:    { type: Date,   default: Date.now, expires: TOKEN_EXPIRE_TIMEOUT },
    session_id:   String,
    reg_info:     {}
  }, {
    versionKey : false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // used when user clicks on activation link in email
  TokenActivationEmail.index({ secret_key: 1 });

  // used to clear all user tokens
  TokenActivationEmail.index({ user_id: 1 });

  //////////////////////////////////////////////////////////////////////////////


  N.wire.on('init:models', function emit_init_TokenActivationEmail() {
    return N.wire.emit('init:models.' + collectionName, TokenActivationEmail);
  });


  N.wire.on('init:models.' + collectionName, function init_model_TokenActivationEmail(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
