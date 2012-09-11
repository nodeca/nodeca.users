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

  , _uname            : String
  , _uname_short      : String

  , _post_count       : { type: Number, default: 0 }

  , _last_visit_ts    : Date
  , _last_visit_ip    : String

  , _warning_points   : { type: Number, default: 0 }
  , _banned_till_ts   : Date
});


User.statics.new_session = function(user_id, ts, ip, callback) {
  this.findOne({ _id: user_id })
      .exec(function(err, user) {
    if (err) {
      callback(err);
      return;
    }
    user._last_visit_ts = ts;
    user._last_visit_ip = ip;
    user.save(function(err) {
      callback(err, user);
    });
  });
};


module.exports.__init__ = function __init__() {
  return mongoose.model('users.User', User);
};
