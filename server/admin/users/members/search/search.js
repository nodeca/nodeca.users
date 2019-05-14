// Search users and display search results
//

'use strict';


const _  = require('lodash');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    $query: { type: 'object', required: false }
  });


  // Parse querystring
  //
  N.wire.before(apiPath, { priority: -20 }, function parse_query(env) {
    env.data.search_params = env.params.$query || {};
  });


  // Call search method (it also validates search query)
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
  N.wire.after(apiPath, async function create_search_form(env) {
    let search_params = env.data.search_params;

    env.res.fields = env.res.fields || [];

    env.res.fields.push({
      name:     'nick',
      value:    search_params.nick,
      priority: 10
    });

    env.res.fields.push({
      name:     'usergroup',
      value:    search_params.usergroup,
      values:   await N.settings.customizers.usergroups(),
      priority: 20
    });

    env.res.fields.push({
      name:     'email',
      value:    search_params.email,
      priority: 30
    });

    env.res.fields.push({
      name:     'reg_date',
      value:    [ search_params.reg_date_from, search_params.reg_date_to ],
      priority: 40
    });

    //env.res.fields.push({
    //  name:     'post_count',
    //  value:    [ search_params.post_count_from, search_params.post_count_to ],
    //  priority: 50
    //});

    if (N.config.users && N.config.users.about) {
      for (let name of Object.keys(N.config.users.about)) {
        env.res.fields.push({
          name,
          value:    search_params[name],
          priority: N.config.users.about[name].priority
        });
      }
    }

    env.res.fields = _.sortBy(env.res.fields, _.property('priority'));
  });
};
