// RPC method used for prefetch on user search page
//

'use strict';


const _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    nick:          { type: 'string' },
    usergroup:     { anyOf: [ { format: 'mongo' }, { type: 'string', pattern: '^$' } ] },
    email:         { type: 'string' },
    reg_date_from: { type: 'string', pattern: '^(\\d{4}-\\d{2}-\\d{2})?$' },
    reg_date_to:   { type: 'string', pattern: '^(\\d{4}-\\d{2}-\\d{2})?$' },
    start:         { type: 'string' },
    limit:         { type: 'number', minimum: 1, maximum: 100 }
  });


  N.wire.before(apiPath, function create_search_query(env) {
    let search_query = env.data.search_query || {};

    if (env.params.nick) {
      search_query.nick = search_query.nick || {};
      search_query.nick.$regex = '^' + _.escapeRegExp(env.params.nick);
      search_query.nick.$options = 'i';
    }

    if (env.params.email) {
      search_query.email = env.params.email;
    }

    if (env.params.usergroup) {
      search_query.usergroups = env.params.usergroup;
    }

    if (env.params.reg_date_from) {
      search_query.joined_ts = search_query.joined_ts || {};
      search_query.joined_ts.$gte = new Date(env.params.reg_date_from);
    }

    if (env.params.reg_date_to) {
      search_query.joined_ts = search_query.joined_ts || {};
      search_query.joined_ts.$lte = new Date(env.params.reg_date_to);
    }

    search_query.nick = search_query.nick || {};
    search_query.nick.$gt = env.params.start;

    if (Object.keys(search_query).length > 0) {
      env.data.search_query = search_query;
    }
  });


  // Do the actual search
  //
  N.wire.on(apiPath, function* members_search(env) {
    if (!env.data.search_query) return;

    env.res.search_results = yield N.models.users.User
                                       .find(env.data.search_query)
                                       .limit(env.params.limit)
                                       .sort('nick')
                                       .lean(true);
  });
};
