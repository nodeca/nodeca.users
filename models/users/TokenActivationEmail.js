/**
 *  class models.users.TokenActivationEmail
 *
 *  Expirable secret key used for email address confirmation by newly
 *  registered users.
 **/


'use strict';


var Mongoose    = require('mongoose');
var Schema      = Mongoose.Schema;
var createToken = require('nodeca.core/lib/app/random_token');


var TOKEN_EXPIRE_TIMEOUT    = 6 * 60 * 60; // 6 hours in seconds.


module.exports = function (N, collectionName) {
  var TokenActivationEmail = new Schema({
    secret_key:       { type: String, 'default': createToken },
    create_ts:        { type: Date,   'default': Date.now, expires: TOKEN_EXPIRE_TIMEOUT },
    ip:               { type: String },
    reg_info:         {},
    oauth_info:       {}
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
