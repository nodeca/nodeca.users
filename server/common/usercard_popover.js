// fetch user info, for popover (rpc only)
//
"use strict";


var user_in_fields = [
  '_id',
  'hid',
  'joined_ts',
  'name',
  'nick',
  'post_count'
];

module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    id: { format: 'mongo', required: true }
  });


  // FIXME reject for guests
  //
  // ##### params
  //
  // - `id`   User._id
  //
  N.wire.on(apiPath, function (env, callback) {

    N.models.users.User
        .findOne({ _id: env.params.id })
        .setOptions({ lean: true })
        .select(user_in_fields.join(' '))
        .exec(function (err, user) {

      if (err) {
        callback(err);
        return;
      }

      env.res.user = user;
      callback();
    });
  });
};
