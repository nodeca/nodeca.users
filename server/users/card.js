"use strict";

/*global nodeca, _*/

var User = nodeca.models.users.User;

var users_in_fields = {
  '_id': 1,
  'id': 1,
  'nick': 1,
  '_post_count': 1,
  '_last_viset_ts': 1
};


// fetch user info (rpc only)
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
