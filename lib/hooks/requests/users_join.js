// Inject info about users to env (~ manual join)
//
"use strict";


var _ = require('lodash');


var users_in_fields = [
  '_id',
  'id',
  '_uname',
  '_uname_short'
];

module.exports = function (N) {

  // fetch and prepare users info
  // fired after each controllers
  // list of user id should be prepared in controller
  N.wire.after('server:**', { weight: 50 }, function join_users(params, callback) {
    var env = this,
        user_id_list, result, UserModel;

    if (!_.isArray(this.data.users) || !this.data.users.length) {
      callback();
      return;
    }

    // There can be some garbage:
    // - empty ids (just because we push data without checks)
    // - duplicated ids(the same users from different objects)
    //
    // We remove dummy elements, but let mongo filter unique values,
    // because it's more fast.
    user_id_list = _.compact(this.data.users);

    env.extras.puncher.start('Users join', { count: user_id_list.length });

    result = this.response.data.users = {};

    // uncomment to imitate empty users (to check template & speed)
    //    env.extras.puncher.stop();
    //    return callback();

    UserModel = N.models.users.User;

    UserModel
        .where('_id').in(user_id_list)
        .select(users_in_fields.join(' '))
        .setOptions({ lean: true }).exec(function (err, user_list) {

      user_list.forEach(function (user) {
        // only registered users can see full name
        if (!env.runtime.is_member) {
          user._uname = user._uname_short;
        }

        result[user._id] = user;
      });

      env.extras.puncher.stop();

      callback();
    });
  });
};