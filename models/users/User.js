"use strict";

/*global nodeca*/

var Crypto = require('crypto');
var mongoose = nodeca.runtime.mongoose;
var Schema = mongoose.Schema;


var User = module.exports.User = new mongoose.Schema({

    // user-friendly id (autoincremented)
    id                : { type: Number, min: 1, index: true }

  , first_name        : String
  , last_name         : String
  , nick              : String

  , joined_ts         : Date

  , primary_group     : Schema.ObjectId
  , secondary_groups  : [Schema.ObjectId]
  , locale            : String

  , _uname            : String
  , _uname_short      : String

  , _post_count       : { type: Number, default: 0 }

  , _last_visit_ts    : Date
  , _last_visit_ip    : String

  , _warning_points   : { type: Number, default: 0 }
  , _banned_till_ts   : Date
});


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
