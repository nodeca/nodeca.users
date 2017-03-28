/**
 *  class models.users.TokenResetPassword
 *
 *  Expirable secret key used for reset password via email.
 **/


'use strict';


var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;
var createToken = require('nodeca.core/lib/app/random_token');


var TOKEN_EXPIRE_TIMEOUT    = 15 * 60; // 15 minutes in seconds.


module.exports = function (N, collectionName) {

  var TokenResetPassword = new Schema({
    secret_key:   { type: String, 'default': createToken },
    create_ts:    { type: Date,   'default': Date, expires: TOKEN_EXPIRE_TIMEOUT },
    user:         Schema.Types.ObjectId,
    ip:           { type: String }
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
