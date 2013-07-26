// Select list of users by part of nick.


'use strict';


function escapeRegexp(source) {
  return String(source).replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
}


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    nick:  { type: 'string', required: true,  minLength: 2 }
  , limit: { type: 'number', required: false, 'default': 10 }
  });

  N.wire.on(apiPath, function moderator_find_user(env, callback) {
    N.models.users.User
        .find()
        .where('nick').regex(new RegExp(escapeRegexp(env.params.nick), 'mi'))
        .limit(env.params.limit)
        .select('_id _uname nick')
        .setOptions({ lean: true })
        .exec(function (err, users) {

      if (err) {
        callback(err);
        return;
      }

      env.response.data.users = users;
      callback();
    });
  });
};
