// Select list of users by part of nick.


'use strict';


function escapeRegexp(source) {
  return String(source).replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
}


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    nick:   { type: 'string',  required: true,  minLength: 2     }
  , strict: { type: 'boolean', required: false, 'default': false }
  });

  N.wire.on(apiPath, function moderator_find_user(env, callback) {
    var query = N.models.users.User.find();

    if (env.params.strict) {
      query.where('nick').equals(env.params.nick);
    } else {
      query.where('nick').regex(new RegExp(escapeRegexp(env.params.nick), 'mi'));
    }

    query.limit(10)
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
