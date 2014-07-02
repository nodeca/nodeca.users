// Store links beetween user and auth providers.
//
// Sub-document describes link info for specified provider
// Note: some fields such as `pass` and `ext_id`,
// could be optional for some providers

'use strict';


var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;
var password = require('./_lib/password');


module.exports = function (N, collectionName) {

  // Provider sub-document schema
  //
  var AuthLink = new Schema({

    user_id          : Schema.Types.ObjectId,

    // Provider types.
    //
    // - `plain` - just email/password pair
    // - `yandex`, `facebook`, `vkontakte`, `twitter` - different oauth
    type             : String,

    // Email is mandatory to `email` provider
    // We also will require it everywhere, when possible (twitter don't have it)
    email            : String,

    // For oauth providers only, external user id
    provider_user_id : String,

    // true if active, false when deleted
    exist            : { 'type': Boolean, 'default': true },

    // Creation date
    created_at       : { 'type': Date, 'default': Date.now },

    // Last login date
    last_at          : Date,

    // Last login ip
    last_ip          : String,

    // metadata, if we like to extract extended info from oauth providers
    // pass, first_name, last_name
    meta             : {}
  },
  {
    versionKey : false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // - plain login
  AuthLink.index({ user_id: 1, type: 1, exist: 1 });

  // used in login via oauth
  AuthLink.index({ provider_user_id: 1, exist: 1 });


  //////////////////////////////////////////////////////////////////////////////

  /**
   * models.users.AuthLink#providers.AuthProvider#setPass(password) -> void
   * - password(String):  user password
   *
   * Generate password hash and put in property
   **/
  AuthLink.methods.setPass = function (pass, callback) {
    if (this.type !== 'plain') {
      callback(new Error('Can\'t set password for non plain provider'));
      return;
    }
    var self = this;
    password.hash(pass, function(err, hash) {
      if (err) {
        callback(err);
        return;
      }
      if (!self.meta) {
        self.meta = {};
      }
      self.meta.pass = hash;
      callback();
    });
  };


  /**
   * models.users.AuthLink#providers.AuthProvider#checkPass(password) -> Boolean
   * - password(String):  checked word
   *
   * Compare word with stored password
   **/
  AuthLink.methods.checkPass = function (pass, callback) {
    if (this.type !== 'plain') {
      callback(new Error('Can\'t set password for non plain provider'));
      return;
    }
    password.check(pass, this.meta.pass, callback);
  };


  //////////////////////////////////////////////////////////////////////////////


  N.wire.on('init:models', function emit_init_AuthLink(__, callback) {
    N.wire.emit('init:models.' + collectionName, AuthLink, callback);
  });


  N.wire.on('init:models.' + collectionName, function init_model_AuthLink(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
