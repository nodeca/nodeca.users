// RPC method used for prefetch on user search page
//

'use strict';


const _ = require('lodash');


module.exports = function (N, apiPath) {
  let validate_params = {
    nick:            { type: 'string' },
    usergroup:       { anyOf: [ { format: 'mongo' }, { type: 'string', pattern: '^$' } ] },
    email:           { type: 'string' },
    reg_date_from:   { type: 'string', pattern: '^(\\d{4}-\\d{2}-\\d{2})?$' },
    reg_date_to:     { type: 'string', pattern: '^(\\d{4}-\\d{2}-\\d{2})?$' },
    post_count_from: { type: 'string', pattern: '^(\\d+)?$' },
    post_count_to:   { type: 'string', pattern: '^(\\d+)?$' },
    start:           { type: 'string' },
    limit:           { type: 'number', minimum: 1, maximum: 100 }
  };

  if (N.config.users && N.config.users.about) {
    for (let name of Object.keys(N.config.users.about)) {
      validate_params[name] = { type: 'string' };
    }
  }

  N.validate(apiPath, {
    properties: validate_params,
    additionalProperties: true
  });


  N.wire.before(apiPath, function create_search_query(env) {
    let search_query = env.data.search_query = env.data.search_query || {};

    if (env.params.nick) {
      // use extended syntax for regexps for nick because
      // we could use additional $gt condition on it
      search_query.nick = search_query.nick || {};
      search_query.nick.$regex = '^' + _.escapeRegExp(env.params.nick);
      search_query.nick.$options = 'i';
    }

    if (env.params.email) {
      search_query.email = new RegExp('^' + _.escapeRegExp(env.params.email), 'i');
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

    if (env.params.post_count_from) {
      search_query.post_count = search_query.post_count || {};
      search_query.post_count.$gte = Number(env.params.post_count_from);
    }

    if (env.params.post_count_to) {
      search_query.post_count = search_query.post_count || {};
      search_query.post_count.$lte = Number(env.params.post_count_to);
    }

    if (N.config.users && N.config.users.about) {
      for (let name of Object.keys(N.config.users.about)) {
        if (env.params[name]) {
          search_query['about.' + name] = new RegExp('^' + _.escapeRegExp(env.params[name]), 'i');
        }
      }
    }

    if (env.params.start) {
      search_query.nick = search_query.nick || {};
      search_query.nick.$gt = env.params.start;
    }

    if (Object.keys(search_query).length > 0) {
      env.data.search_query = search_query;
    }
  });


  // Do the actual search
  //
  N.wire.on(apiPath, function* members_search(env) {
    if (!env.data.search_query) return;

    let load_count = env.params.limit || 100;

    let search_results = yield N.models.users.User
                                   .find(env.data.search_query)
                                   .sort('nick')
                                   .limit(load_count + 1)
                                   .lean(true);

    // check if more results are available
    if (search_results.length > load_count) {
      search_results.pop();
      env.res.prefetch_start = search_results[search_results.length - 1].nick;
    }

    env.res.search_results = search_results.map(user => ({
      hid:            user.hid,
      name:           user.name,
      email:          user.email,
      last_active_ts: user.last_active_ts,
      joined_ts:      user.joined_ts,
      post_count:     user.post_count
    }));

    env.res.search_query = env.params;
  });
};
