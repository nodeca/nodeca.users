// Search users and display search results
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
    post_count_to:   { type: 'string', pattern: '^(\\d+)?$' }
  };

  if (N.config.users && N.config.users.about) {
    for (let name of Object.keys(N.config.users.about)) {
      validate_params[name] = { type: 'string' };
    }
  }

  N.validate(apiPath, validate_params);


  // Call search method
  //
  N.wire.before(apiPath, function call_search(env) {
    return N.wire.emit('server:admin.users.members.search.list', env);
  });


  // Fill head
  //
  N.wire.on(apiPath, function fill_head(env) {
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

    env.res.fields.push({
      name:     'post_count',
      value:    [ env.params.post_count_from, env.params.post_count_to ],
      priority: 50
    });

    if (N.config.users && N.config.users.about) {
      for (let name of Object.keys(N.config.users.about)) {
        env.res.fields.push({
          name,
          value:    env.params[name],
          priority: N.config.users.about[name].priority
        });
      }
    }

    env.res.fields = _.sortBy(env.res.fields, _.property('priority'));
  });
};
