"use strict";

/*global nodeca, _*/

var User = nodeca.models.users.User;

var user_in_fields = [
  '_id',
  'id',
  'nick',
  '_post_count',
  '_last_viset_ts'
];


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
  User.findOne(query).select(user_in_fields.join(' ')).
      setOptions({ lean: true }).exec(function(err, user){
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
