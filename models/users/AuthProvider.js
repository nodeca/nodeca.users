// Store links beetween user and auth providers.
//
// Sub-document describes link info for specified provider
// Note: some fields such as `pass` and `ext_id`,
// could be optional for some providers

'use strict';


const _               = require('lodash');
const Mongoose        = require('mongoose');
const Schema          = Mongoose.Schema;
const password        = require('./_lib/password');
const normalize_email = require('./_lib/normalize_email');


module.exports = function (N, collectionName) {

  // Provider sub-document schema
  //
  let AuthProvider = new Schema({

    user:             Schema.Types.ObjectId,

    // Provider types.
    //
    // - `plain` - just email/password pair
    // - `yandex`, `facebook`, `vkontakte`, `twitter` - different oauth
    type:             String,

    // Email is mandatory to `email` provider
    // We also will require it everywhere, when possible (twitter don't have it)
    email:            String,

    // normalized email, only used to check email uniqueness during
    // registration
    email_normalized: String,

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
  }, {
    versionKey : false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // - plain login
  AuthProvider.index({ user: 1, type: 1, exists: 1 });

  // used in login via oauth
  AuthProvider.index({ provider_user_id: 1, exists: 1 });

  // find similar emails
  AuthProvider.index({ email: 1 });


  //////////////////////////////////////////////////////////////////////////////

  /**
   * models.users.AuthProvider#providers.AuthProvider#setPass(password) -> void
   * - password(String):  user password
   *
   * Generate password hash and put in property
   **/
  AuthProvider.methods.setPass = function (pass) {
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
   * models.users.AuthProvider#providers.AuthProvider#setPassHash(password) -> void
   * - password(String):  user password hash
   *
   * Set user password
   **/
  AuthProvider.methods.setPassHash = function (hash) {
    if (this.type !== 'plain') {
      return Promise.reject(new Error("Can't set password for non plain provider"));
    }

    _.set(this, 'meta.pass', hash);

    // Notify mongoose about changes in nested object
    this.markModified('meta');

    return Promise.resolve();
  };


  /**
   * models.users.AuthProvider#providers.AuthProvider#checkPass(password) -> Boolean
   * - password(String):  checked word
   *
   * Compare word with stored password
   **/
  AuthProvider.methods.checkPass = function (pass) {
    if (this.type !== 'plain') {
      return Promise.reject(new Error("Can't set password for non plain provider"));
    }

    return password.check(pass, _.get(this, 'meta.pass'));
  };


  /**
   * models.users.AuthProvider#similarEmailExists(email) -> Boolean
   * - email(String): email to check
   *
   * Check if similar email address is already registered
   **/
  AuthProvider.statics.similarEmailExists = async function similarEmailExists(email) {
    let authProvider = await N.models.users.AuthProvider
                             .findOne({ exists: true })
                             .where('email_normalized').equals(normalize_email(email))
                             .select('_id')
                             .lean(true);

    return authProvider ? true : false;
  };


  // Set normalized authprovider
  //
  AuthProvider.pre('save', function () {
    if (this.isModified('email')) {
      this.email_normalized = normalize_email(this.email);
    }
  });


  //////////////////////////////////////////////////////////////////////////////


  N.wire.on('init:models', function emit_init_AuthProvider() {
    return N.wire.emit('init:models.' + collectionName, AuthProvider);
  });


  N.wire.on('init:models.' + collectionName, function init_model_AuthProvider(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
