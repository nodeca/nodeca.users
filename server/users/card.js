"use strict";

/*global nodeca, _*/

var User = nodeca.models.users.User;

// fetch all, but this
var users_in_fields = {
  'password': 0,
  '_last_viset_ip': 0
};


// fetch user info (realtime only)
//
// FIXME reject for guests
//
// ##### params
//
// - `id`   User._id
//
module.exports = function (params, next) {
  var env = this;
  var query = { _id: params.id };
  User.findOne(query).select(users_in_fields).
      setOptions({lean:true}).exec(function(err, user){
    if (err) {
      next(err);
      return;
    }
    env.data.user = user;
    next();
  });
};


// Build response
nodeca.filters.after('@', function (params, next) {
  this.response.data.user = this.data.user;
  next();
});
