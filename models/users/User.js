"use strict";

/*global nodeca*/

var Crypto = require('crypto');
var mongoose = nodeca.runtime.mongoose;
var Schema = mongoose.Schema;

var cache = {
    post_count        : { type: Number, default: 0 }

  , last_visit_ts     : Date
  , last_viset_ip     : String

  , warning_points    : { type: Number, default: 0 }
  , banned_till_ts    : Date

  , userpic_version   : { type: Number, default: 0 }
  , avatar_version    : { type: Number, default: 0 }
};

var User = module.exports.User = new mongoose.Schema({

    // user-friendly id (autoincremented)
    id                : { type: Number, required: true, min: 1, index: true }

  , first_name        : String
  , last_name         : String
  , nick              : String
  , password          : String
  , email             : String

  , joined_ts         : Date

  , primary_group     : Schema.ObjectId
  , secondary_groups  : [Schema.ObjectId]

  , cache             : cache
});


var hash = function(password, salt) {
  return Crypto.createHmac('sha256', salt).update(password).digest('hex');
};

User.methods.setPass = function(password) {
  this.password = hash(password, password + this.joined_ts);
};

module.exports.__init__ = function __init__() {
  return mongoose.model('users.User', User);
};
