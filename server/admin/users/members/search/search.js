// Search users and display search results
//

'use strict';


const _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    nick:          { type: 'string' },
    usergroup:     { anyOf: [ { format: 'mongo' }, { type: 'string', pattern: '^$' } ] },
    email:         { type: 'string' },
    reg_date_from: { type: 'string', pattern: '^(\\d{4}-\\d{2}-\\d{2})?$' },
    reg_date_to:   { type: 'string', pattern: '^(\\d{4}-\\d{2}-\\d{2})?$' }
  });


  N.wire.before(apiPath, function create_search_query(env) {
    let search_query = env.data.search_query || {};

    if (env.params.nick) {
      search_query.nick = env.params.nick;
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

    if (Object.keys(search_query).length > 0) {
      env.data.search_query = search_query;
    }
  });


  // Do the actual search
  //
  N.wire.on(apiPath, function* members_search(env) {
    if (!env.data.search_query) return;

    let search_results = yield N.models.users.User.find(env.data.search_query).limit(51).lean(true);

    env.res.search_results = search_results.slice(0, 50);
    env.res.search_query = env.params;
    env.res.reached_end = env.res.search_results.length >= search_results.length;
  });


  // Fill head
  //
  N.wire.after(apiPath, function fill_head(env) {
    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title');
  });


  // Prepare profile fields for the search form
  //
  N.wire.after(apiPath, function* create_search_form(env) {
    env.res.fields = env.res.fields || [];

    env.res.fields.push({
      name:     'nick',
      value:    env.params.nick,
      priority: 10
    });

    env.res.fields.push({
      name:     'usergroup',
      value:    env.params.usergroup,
      values:   yield N.settings.customizers.usergroups(),
      priority: 20
    });

    env.res.fields.push({
      name:     'email',
      value:    env.params.email,
      priority: 30
    });

    env.res.fields.push({
      name:     'reg_date',
      value:    [ env.params.reg_date_from, env.params.reg_date_to ],
      priority: 40
    });

    env.res.fields = _.sortBy(env.res.fields, _.property('priority'));
  });
};
