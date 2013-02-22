"use strict";


var Mongoose = require('mongoose');
var xregexp = require('xregexp').XRegExp;


var Schema = Mongoose.Schema;


////////////////////////////////////////////////////////////////////////////////

module.exports = function (N, collectionName) {

  /**
   *  new models.users.User()
   **/
  var User = module.exports.User = new Schema({

    // user-friendly id (autoincremented)
    id                : { type: Number, min: 1, index: true }

  , first_name        : String
  , last_name         : String
  , nick              : String

  , usergroups        : [Schema.Types.ObjectId]

  , joined_ts         : Date
  , joined_ip         : String

  , locale            : String

  , _uname            : String
  , _uname_short      : String

  , post_count       : { type: Number, 'default': 0 }

  , warning_points   : { type: Number, 'default': 0 }
  });


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
  User.pre('save', function (next) {
    this._uname_short = this.nick;
    if (!!this.first_name && !!this.last_name) {
      this._uname = this.first_name +
        ' (' + this.nick + ') ' + this.last_name;
    }
    else {
      this._uname = this._uname_short;
    }
    next();
  });


  N.wire.on("init:models", function emit_init_User(__, callback) {
    N.wire.emit("init:models." + collectionName, User, callback);
  });

  N.wire.on("init:models." + collectionName, function init_model_User(schema) {
    N.models[collectionName] = Mongoose.model(collectionName, schema);
  });
};
