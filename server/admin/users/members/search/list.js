// RPC method used for prefetch on user search page
//

'use strict';


const _         = require('lodash');
const validator = require('is-my-json-valid');


module.exports = function (N, apiPath) {

  // all validation is performed later (so it can be shared with search.js and
  // extended from other packages)
  N.validate(apiPath, { properties: {}, additionalProperties: true });

  let validate_properties = {
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
      validate_properties[name] = { type: 'string' };
    }
  }

  const validate = validator({
    type: 'object',
    properties: validate_properties,
    additionalProperties: true
  });


  N.wire.before(apiPath, { priority: -20 }, function get_query(env) {
    // if this method is called by RPC, query is in `env.params`, if this
    // method is called from search.js as a subcall, data is
    // in `env.data.search_params`
    if (!env.data.search_params) {
      env.data.search_params = env.params;
    }

    if (!validate(env.data.search_params)) throw N.io.BAD_REQUEST;
  });


  N.wire.before(apiPath, function create_search_query(env) {
    let search_query = env.data.search_query = env.data.search_query || {};
    let search_params = env.data.search_params;

    if (search_params.nick) {
      search_query.nick_normalized_lc = new RegExp('^' + _.escapeRegExp(search_params.nick.toLowerCase()));
    }

    if (search_params.email) {
      search_query.email = new RegExp('^' + _.escapeRegExp(search_params.email), 'i');
    }

    if (search_params.usergroup) {
      search_query.usergroups = search_params.usergroup;
    }

    if (search_params.reg_date_from) {
      search_query.joined_ts = search_query.joined_ts || {};
      search_query.joined_ts.$gte = new Date(search_params.reg_date_from);
    }

    if (search_params.reg_date_to) {
      search_query.joined_ts = search_query.joined_ts || {};
      search_query.joined_ts.$lte = new Date(search_params.reg_date_to);
    }

    if (search_params.post_count_from) {
      search_query.post_count = search_query.post_count || {};
      search_query.post_count.$gte = Number(search_params.post_count_from);
    }

    if (search_params.post_count_to) {
      search_query.post_count = search_query.post_count || {};
      search_query.post_count.$lte = Number(search_params.post_count_to);
    }

    if (N.config.users && N.config.users.about) {
      for (let name of Object.keys(N.config.users.about)) {
        if (search_params[name]) {
          search_query['about.' + name] = new RegExp('^' + _.escapeRegExp(search_params[name]), 'i');
        }
      }
    }

    if (search_params.start) {
      search_query.nick = search_query.nick || {};
      search_query.nick.$gt = search_params.start;
    }
  });


  // Do the actual search
  //
  N.wire.on(apiPath, function* members_search(env) {
    if (!env.data.search_query) return;

    let load_count = env.data.search_params.limit || 100;

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
      post_count:     user.post_count,
      exists:         user.exists
    }));

    env.res.search_query = env.data.search_params;
  });
};
