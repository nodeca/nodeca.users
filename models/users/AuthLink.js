// Store links beetween user and auth providers.
//
// Sub-document describes link info for specified provider
// Note: some fields such as `pass` and `ext_id`,
// could be optional for some providers

'use strict';


const _        = require('lodash');
const Mongoose = require('mongoose');
const Schema   = Mongoose.Schema;
const password = require('./_lib/password');


module.exports = function (N, collectionName) {

  // Provider sub-document schema
  //
  let AuthLink = new Schema({

    user:             Schema.Types.ObjectId,

    // Provider types.
    //
    // - `plain` - just email/password pair
    // - `yandex`, `facebook`, `vkontakte`, `twitter` - different oauth
    type:             String,

    // Email is mandatory to `email` provider
    // We also will require it everywhere, when possible (twitter don't have it)
    email:            String,

    // For oauth providers only, external user id
    provider_user_id: String,

    // true if active, false when deleted
    exists:           { type: Boolean, 'default': true },

    // Creation date
    ts:               { type: Date, 'default': Date.now },

    // Creation ip
    ip:               String,

    // Last login date
    last_ts:          { type: Date, 'default': Date.now },

    // Last login ip
    last_ip:          String,

    // metadata, if we like to extract extended info from oauth providers
    // pass, first_name, last_name
    meta:             {}
  },
  {
    versionKey : false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // - plain login
  AuthLink.index({ user: 1, type: 1, exists: 1 });

  // used in login via oauth
  AuthLink.index({ provider_user_id: 1, exists: 1 });


  //////////////////////////////////////////////////////////////////////////////

  /**
   * models.users.AuthLink#providers.AuthProvider#setPass(password) -> void
   * - password(String):  user password
   *
   * Generate password hash and put in property
   **/
  AuthLink.methods.setPass = function (pass) {
    if (this.type !== 'plain') {
      return Promise.reject(new Error("Can't set password for non plain provider"));
    }

    return password.hash(pass).then(hash => {
      _.set(this, 'meta.pass', hash);

      // Notify mongoose about changes in nested object
      this.markModified('meta');
    });
  };


  /**
   * models.users.AuthLink#providers.AuthProvider#setPassHash(password) -> void
   * - password(String):  user password hash
   *
   * Set user password
   **/
  AuthLink.methods.setPassHash = function (hash) {
    if (this.type !== 'plain') {
      return Promise.reject(new Error("Can't set password for non plain provider"));
    }

    _.set(this, 'meta.pass', hash);

    // Notify mongoose about changes in nested object
    this.markModified('meta');

    return Promise.resolve();
  };


  /**
   * models.users.AuthLink#providers.AuthProvider#checkPass(password) -> Boolean
   * - password(String):  checked word
   *
   * Compare word with stored password
   **/
  AuthLink.methods.checkPass = function (pass) {
    if (this.type !== 'plain') {
      return Promise.reject(new Error("Can't set password for non plain provider"));
    }

    return password.check(pass, _.get(this, 'meta.pass'));
  };


  //////////////////////////////////////////////////////////////////////////////


  N.wire.on('init:models', function emit_init_AuthLink() {
    return N.wire.emit('init:models.' + collectionName, AuthLink);
  });


  N.wire.on('init:models.' + collectionName, function init_model_AuthLink(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
