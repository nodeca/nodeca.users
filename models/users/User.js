"use strict";


/**
 * nodeca.models
 **/


/**
 *  class nodeca.models.User
 **/


/*global nodeca*/

var mongoose = nodeca.components.mongoose;
var Schema = mongoose.Schema;


/**
 *  new nodeca.models.User()
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

  , post_count       : { type: Number, default: 0 }

  , warning_points   : { type: Number, default: 0 }
});


var NICK_RE = nodeca.components.XRegExp('^[\\p{L}\\d\\-_]{3,}$');


/**
 *  nodeca.models.User.validateNick(str) -> Boolean
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


var PASSWORD_RE = nodeca.components.XRegExp('\\p{L}');


/**
 *  nodeca.models.User.validatePassword(str) -> Boolean
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


module.exports.__init__ = function __init__() {
  return mongoose.model('users.User', User);
};
