// Get a specified amount of items before or after an item with given id
//
'use strict';

const _  = require('lodash');


// Max topics to fetch before and after
const LIMIT = 50;

module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true },
    type:     { type: 'string',  required: true },
    start:    { format: 'mongo', required: true },
    before: {
      type: 'integer',
      minimum: 0,
      maximum: LIMIT,
      required: true
    },
    after: {
      type: 'integer',
      minimum: 0,
      maximum: LIMIT,
      required: true
    }
  });


  // Fetch owner
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env) {
    return N.wire.emit('internal:users.fetch_user_by_hid', env);
  });


  // Forbid access to pages owned by bots
  //
  N.wire.before(apiPath, async function bot_member_pages_forbid_access(env) {
    let is_bot = await N.settings.get('is_bot', {
      user_id: env.data.user._id,
      usergroup_ids: env.data.user.usergroups
    }, {});

    if (is_bot) throw N.io.NOT_FOUND;
  });


  // Validate type, update counter for the current type
  //
  N.wire.before(apiPath, async function get_content_types(env) {
    let menu = _.get(N.config, 'users.activity.menu', {});
    let content_types = Object.keys(menu)
                         .sort((a, b) => (menu[a].priority || 100) - (menu[b].priority || 100));

    env.data.type = env.params.type;

    // validate content type
    if (content_types.indexOf(env.data.type) === -1) {
      throw N.io.BAD_REQUEST;
    }

    // fetch counters
    let sub_env = {
      params: {
        user_id:   env.data.user._id,
        user_info: env.user_info
      }
    };

    await N.wire.emit('internal:users.activity.' + env.data.type + ':count', sub_env);

    env.res.total = sub_env.count;
  });


  // Get user activity list
  //
  N.wire.on(apiPath, async function user_activity(env) {
    let sub_env = {
      params: {
        user_id:   env.data.user._id,
        user_info: env.user_info,
        start:     env.params.start,
        before:    env.params.before,
        after:     env.params.after
      }
    };

    await N.wire.emit('internal:users.activity.' + env.data.type, sub_env);

    env.res.results       = sub_env.results;
    env.res.top_marker    = sub_env.top_marker;
    env.res.bottom_marker = sub_env.bottom_marker;

    env.data.users = (env.data.users || []).concat(sub_env.users);
  });
};
