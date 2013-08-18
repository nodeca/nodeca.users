/**
 *  class models.users.TokenResetPassword
 *
 *  Expirable secret key used for reset password via email.
 **/


'use strict';


var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;
var crypto   = require('crypto');


var TOKEN_EXPIRE_TIMEOUT    = 15 * 60; // 15 minutes in seconds.
var TOKEN_SECRET_KEY_LENGTH = 32;


function generateSecretKey() {
  return crypto.randomBytes(TOKEN_SECRET_KEY_LENGTH).toString('hex');
}


module.exports = function (N, collectionName) {
  var TokenResetPassword = new Schema({
    secret_key:      { type: String, 'default': generateSecretKey, required: true }
  , create_ts:       { type: Date,   'default': Date,              expires: TOKEN_EXPIRE_TIMEOUT, required: true }
  , authlink_id:     { type: Schema.Types.ObjectId,                required: true }
  , authprovider_id: { type: Schema.Types.ObjectId,                required: true }
  },
  {
    versionKey : false
  });

  TokenResetPassword.index({ secret_key: 1 });
  TokenResetPassword.index({ authprovider_id: 1 });

  TokenResetPassword.methods.isExpired = function isExpired() {
    return Date.now() >= (this.create_ts.getTime() + TOKEN_EXPIRE_TIMEOUT * 1000);
  };


  N.wire.on("init:models", function emit_init_TokenResetPassword(__, callback) {
    N.wire.emit("init:models." + collectionName, TokenResetPassword, callback);
  });

  N.wire.on("init:models." + collectionName, function init_model_TokenResetPassword(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
