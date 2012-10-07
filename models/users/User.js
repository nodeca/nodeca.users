"use strict";

/*global nodeca*/

var mongoose = nodeca.components.mongoose;
var Schema = mongoose.Schema;


var User = module.exports.User = new Schema({

    // user-friendly id (autoincremented)
    id                : { type: Number, min: 1, index: true }

  , first_name        : String
  , last_name         : String
  , nick              : String

  , joined_ts         : Date
  , joined_ip         : String

  , locale            : String

  , _uname            : String
  , _uname_short      : String

  , post_count       : { type: Number, default: 0 }

  , warning_points   : { type: Number, default: 0 }

});

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
