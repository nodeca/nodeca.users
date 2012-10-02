"use strict";

/*global nodeca*/

var User = nodeca.models.users.User;

var user_in_fields = [
  '_id',
  'id',
  'joined_ts',
  '_uname',
  '_uname_short',
  '_post_count',
  '_last_viset_ts'
];

// Validate input parameters
//
var params_schema = {
  id: {
    type: 'string',
    required: true
  }
};


nodeca.validate(params_schema);


// fetch user info (rpc only)
//
// FIXME reject for guests
//
// ##### params
//
// - `id`   User._id
//
module.exports = function (params, next) {
  var data  = this.response.data;
  var query = User.findOne({ _id: params.id }).setOptions({ lean: true });

  query.select(user_in_fields.join(' ')).exec(function (err, user) {
    if (err) {
      next(err);
      return;
    }

    data.user = user;
    next();
  });
};
