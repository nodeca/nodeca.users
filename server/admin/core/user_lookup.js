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
    nick:   { type: 'string',  required: true },
    strict: { type: 'boolean', required: true }
  });

  N.wire.on(apiPath, function* moderator_find_user(env) {
    if (env.params.nick.length < 3 && !env.params.strict) {
      env.res = [];
      return;
    }

    var query = N.models.users.User.find();

    if (env.params.strict) {
      query.where('nick').equals(env.params.nick);
    } else {
      query.where('nick_normalized_lc').regex(new RegExp('^' + escapeRegexp(env.params.nick.toLowerCase())));
    }

    env.res = yield query.limit(10)
                         .select('_id name nick')
                         .sort('nick')
                         .lean(true);
  });
};
