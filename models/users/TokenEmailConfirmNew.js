/**
 *  class models.users.TokenEmailConfirmNew
 *
 *  Confirm new email when changing to it
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

  let TokenEmailConfirmNew = new Schema({
    secret_key:   { type: String, default: createDecimalToken },
    create_ts:    { type: Date,   default: Date.now, expires: TOKEN_EXPIRE_TIMEOUT },
    user:         Schema.Types.ObjectId,
    new_email:    { type: String },
    session_id:   { type: String }
  }, {
    versionKey : false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // used when user clicks reset link in email
  TokenEmailConfirmNew.index({ secret_key: 1 });

  //////////////////////////////////////////////////////////////////////////////


  N.wire.on('init:models', function emit_init_TokenEmailConfirmNew() {
    return N.wire.emit('init:models.' + collectionName, TokenEmailConfirmNew);
  });


  N.wire.on('init:models.' + collectionName, function init_model_TokenEmailConfirmNew(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
