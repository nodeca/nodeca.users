// Find one user by full nick match.


'use strict';


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    nick: { type: 'string', required: true }
  });

  N.wire.on(apiPath, function (env, callback) {
    N.models.users.User
        .findOne({ nick: env.params.nick })
        .select('_id')
        .setOptions({ lean: true })
        .exec(function (err, user) {

      if (err) {
        callback(err);
        return;
      }

      if (!user) {
        callback(N.io.NOT_FOUND);
        return;
      }

      env.response.data.user = user;
      callback();
    });
  });
};
