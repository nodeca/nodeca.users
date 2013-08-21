// Select list of users, starting by pattern (or exact match)


'use strict';


function escapeRegexp(source) {
  return String(source).replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1');
}

// - nick - first letters of nick
// - strict - exact match when true
//
module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    nick:   { type: 'string',  required: true,  minLength: 1     }
  , strict: { type: 'boolean', required: false, 'default': false }
  });

  N.wire.on(apiPath, function moderator_find_user(env, callback) {
    var query = N.models.users.User.find();

    if (env.params.strict) {
      query.where('nick').equals(env.params.nick);
    } else {
      query.where('nick').regex(new RegExp('^' + escapeRegexp(env.params.nick), 'i'));
    }

    query.limit(10)
         .select('_id name nick')
         .setOptions({ lean: true })
         .exec(function (err, users) {

      if (err) {
        callback(err);
        return;
      }

      env.res.users = users;
      callback();
    });
  });
};
