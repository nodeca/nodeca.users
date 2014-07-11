'use strict';


var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;
var xregexp  = require('xregexp').XRegExp;


module.exports = function (N, collectionName) {

  var User = new Schema({
    // user-friendly id (autoincremented)
    hid            : Number,

    first_name     : String,
    last_name      : String,
    nick           : String,
    email          : String,
    usergroups     : [ Schema.Types.ObjectId ],
    joined_ts      : { type: Date, 'default': Date.now },
    joined_ip      : String,

    // false -> deleted accounts
    exists         : { type: Boolean, 'default': true },
    // true -> `hell banned` user
    hb             : { type: Boolean, 'default': false },

    locale         : String,
    name           : String,
    post_count     : { type: Number, 'default': 0 }
  },
  {
    versionKey : false
  });

  // Indexes
  //////////////////////////////////////////////////////////////////////////////

  // Needed to fetch profile page
  User.index({ usergroups: 1 });

  // Needed to count users in group
  User.index({ usergroups: 1 });

  // Needed for nick search
  User.index({ nick: 1 });

  //////////////////////////////////////////////////////////////////////////////


  var NICK_RE = xregexp('^[\\p{L}\\d\\-_]{3,}$');


  /**
   *  models.users.User.validateNick(str) -> Boolean
   *  - str (String): String to validate.
   *
   *  Returns whenever or not `str` is a valid nickname:
   *
   *  - length equals or greater than 3
   *  - it consist of letters, numbers, dashes (-) and underscores (_) only.
   **/
  User.statics.validateNick = function validateNick(str) {
    return NICK_RE.test(str);
  };


  var PASSWORD_RE = xregexp('\\p{L}');


  /**
   *  models.users.User.validatePassword(str) -> Boolean
   *  - str (String): String to validate.
   *
   *  Returns whenever or not `str` is a valid password:
   *
   *  - length equals or greater than 8
   *  - has at least one number
   *  - has at least one letter
   **/
  User.statics.validatePassword = function validatePassword(str) {
    return 8 <= str.length && /\d/.test(str) && PASSWORD_RE.test(str);
  };


  // FIXME: make denormalisation customizeable
  //
  // Update full name, on dependencies change (nick /first name / last name)
  //
  User.pre('save', function (callback) {

    // skip, if nothing changed
    if (this.isModified('nick') || this.isModified('first_name') || this.isModified('last_name')) {
      if (!!this.first_name && !!this.last_name) {
        this.name = this.first_name + ' (' + this.nick + ') ' + this.last_name;
      }
      else {
        this.name = this.nick;
      }
    }

    callback();
  });


  // Set 'hid' for the new user. This hook should always be
  // the last one to avoid counter increment on error
  //
  User.pre('save', function (callback) {
    if (!this.isNew) {
      callback();
      return;
    }

    var self = this;
    N.models.core.Increment.next('user', function(err, value) {
      if (err) {
        callback(err);
        return;
      }
      self.hid = value;
      callback();
    });
  });


  // Creates default album for new user
  //
  User.pre('save', function (callback) {
    if (!this.isNew) {
      callback();
      return;
    }

    var album = new N.models.users.Album();
    album.default = true;
    // this._id generates automatically before first pre('save') call
    album.user_id = this._id;
    album.save(callback);
  });


  N.wire.on('init:models', function emit_init_User(__, callback) {
    N.wire.emit('init:models.' + collectionName, User, callback);
  });

  N.wire.on('init:models.' + collectionName, function init_model_User(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
