/**
 *  class models.users.TokenEmailChange
 *
 *  When user changes email without password, require confirmation from old email
 **/


'use strict';


const BigNumber   = require('bignumber.js');
const Mongoose    = require('mongoose');
const Schema      = Mongoose.Schema;
const createToken = require('nodeca.core/lib/app/random_token');

const TOKEN_EXPIRE_TIMEOUT    = 15 * 60; // 15 minutes in seconds.

function createDecimalToken() {
  // convert to decimal because it's easier for user to type, get last 30
  // digits because first few digits don't have uniform distribution
  return new BigNumber('0x' + createToken()).toString(10).slice(-30);
}


module.exports = function (N, collectionName) {

  let TokenEmailChange = new Schema({
    secret_key:   { type: String, default: createDecimalToken },
    create_ts:    { type: Date,   default: Date.now, expires: TOKEN_EXPIRE_TIMEOUT },
    user:         Schema.Types.ObjectId,
    session_id:   { type: String }
  }, {
    versionKey : false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // used when user clicks reset link in email
  TokenEmailChange.index({ secret_key: 1 });

  //////////////////////////////////////////////////////////////////////////////


  N.wire.on('init:models', function emit_init_TokenEmailChange() {
    return N.wire.emit('init:models.' + collectionName, TokenEmailChange);
  });


  N.wire.on('init:models.' + collectionName, function init_model_TokenEmailChange(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
