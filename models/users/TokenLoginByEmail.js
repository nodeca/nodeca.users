/**
 *  class models.users.TokenLoginByEmail
 *
 *  One-time token issued and sent to email when user tries to log in
 *  without using a password.
 **/


'use strict';


const BigNumber   = require('bignumber.js');
const Mongoose    = require('mongoose');
const Schema      = Mongoose.Schema;
const createToken = require('nodeca.core/lib/app/random_token');

const TOKEN_EXPIRE_TIMEOUT = 5 * 60; // 5 minutes

function createDecimalToken() {
  // convert to decimal because it's easier for user to type, get last 30
  // digits because first few digits don't have uniform distribution
  return new BigNumber('0x' + createToken()).toString(10).slice(-30);
}


module.exports = function (N, collectionName) {

  let TokenLoginByEmail = new Schema({
    secret_key:   { type: String, default: createDecimalToken },
    create_ts:    { type: Date,   default: Date.now, expires: TOKEN_EXPIRE_TIMEOUT },
    session_id:   { type: String },
    user:         Schema.Types.ObjectId,
    authprovider: Schema.Types.ObjectId,
    redirect_id:  Schema.Types.ObjectId
  }, {
    versionKey : false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // used when user clicks reset link in email
  TokenLoginByEmail.index({ secret_key: 1 });

  //////////////////////////////////////////////////////////////////////////////


  N.wire.on('init:models', function emit_init_TokenLoginByEmail() {
    return N.wire.emit('init:models.' + collectionName, TokenLoginByEmail);
  });


  N.wire.on('init:models.' + collectionName, function init_model_TokenLoginByEmail(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
