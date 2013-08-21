'use strict';


var Mongoose = require('mongoose');
var Schema   = Mongoose.Schema;
var xregexp  = require('xregexp').XRegExp;


module.exports = function (N, collectionName) {

  /**
   *  new models.users.User()
   **/
  var User = new Schema({
    // user-friendly id (autoincremented)
    hid            : { type: Number }

  , first_name     : String
  , last_name      : String
  , nick           : String

  , usergroups     : [Schema.Types.ObjectId]

  , joined_ts      : Date
  , joined_ip      : String

    // false -> deleted accounts
  , exists         : { type: Boolean, required: true, 'default': true }
    // true -> `hell banned` user
  , hb             : { type: Boolean, 'default': false }

  , locale         : String

  , name         : String

  , post_count     : { type: Number, 'default': 0 }
  },
  {
    versionKey : false
  });

  // Needed to fetch profile page
  User.index({ usergroups: 1 });

  // Needed to count users in group
  User.index({ usergroups: 1 });

  // Needed for nick search
  User.index({ nick: 1 });


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
  User.pre('save', function (callback) {
    if (!!this.first_name && !!this.last_name) {
      this.name = this.first_name +
        ' (' + this.nick + ') ' + this.last_name;
    }
    else {
      this.name = this.nick;
    }
    callback();
  });

  // Set 'hid' for the new user.
  // This hook should always be the last one to avoid counter increment on error
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

  N.wire.on("init:models", function emit_init_User(__, callback) {
    N.wire.emit("init:models." + collectionName, User, callback);
  });

  N.wire.on("init:models." + collectionName, function init_model_User(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
