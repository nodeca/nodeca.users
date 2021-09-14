/**
 *  class models.users.TokenResetPassword
 *
 *  Expirable secret key used for reset password via email.
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

  let TokenResetPassword = new Schema({
    secret_key:   { type: String, default: createDecimalToken },
    create_ts:    { type: Date,   default: Date.now, expires: TOKEN_EXPIRE_TIMEOUT },
    session_id:   { type: String },
    user:         Schema.Types.ObjectId
  }, {
    versionKey : false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // used when user clicks reset link in email
  TokenResetPassword.index({ secret_key: 1 });

  //////////////////////////////////////////////////////////////////////////////


  N.wire.on('init:models', function emit_init_TokenResetPassword() {
    return N.wire.emit('init:models.' + collectionName, TokenResetPassword);
  });


  N.wire.on('init:models.' + collectionName, function init_model_TokenResetPassword(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
