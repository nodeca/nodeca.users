/**
 *  class models.users.TokenConfirmEmail
 *
 *  Expirable secret key used for email address confirmation by newly
 *  registered users.
 **/


'use strict';


var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;
var crypto   = require('crypto');


var TOKEN_EXPIRE_TIMEOUT    = 6 * 60 * 60; // 6 hours.
var TOKEN_SECRET_KEY_LENGTH = 12;


function generateSecretKey() {
  return crypto.randomBytes(TOKEN_SECRET_KEY_LENGTH).toString('hex');
}


module.exports = function (N, collectionName) {
  var TokenConfirmEmail = new Schema({
    user_id:    { type: Schema.Types.ObjectId, required: true   }
  , secret_key: { type: String, 'default': generateSecretKey    }
  , create_ts:  { type: Date,    expires:  TOKEN_EXPIRE_TIMEOUT }
  });

  TokenConfirmEmail.statics.generateSecretKey = generateSecretKey;

  TokenConfirmEmail.methods.check = function check() {
    return Date.now() < (this.create_ts.getTime() + TOKEN_EXPIRE_TIMEOUT);
  };

  TokenConfirmEmail.index({ user_id: 1 }, { unique: true });


  N.wire.on("init:models", function emit_init_TokenConfirmEmail(__, callback) {
    N.wire.emit("init:models." + collectionName, TokenConfirmEmail, callback);
  });

  N.wire.on("init:models." + collectionName, function init_model_TokenConfirmEmail(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
