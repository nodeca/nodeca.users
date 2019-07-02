// Shows activity page


'use strict';


const _  = require('lodash');

const ITEMS_PER_PAGE = 40;


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true },
    type:     { type: 'string',  required: false },
    start:    { format: 'mongo', required: false }
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


  // Get all available content types, fetch counters for each, determine active one
  //
  N.wire.before(apiPath, async function get_content_types(env) {
    let menu = _.get(N.config, 'users.activity.menu', {});
    let content_types = Object.keys(menu)
                         .sort((a, b) => (menu[a].priority || 100) - (menu[b].priority || 100));

    // if type is not specified, select first one
    env.data.type = env.params.type || content_types[0];

    // validate content type
    if (content_types.indexOf(env.data.type) === -1) {
      throw N.io.BAD_REQUEST;
    }

    // fetch all counters
    let counts = {};

    await Promise.all(content_types.map(async type => {
      let sub_env = {
        params: {
          user_id:   env.data.user._id,
          user_info: env.user_info
        }
      };

      await N.wire.emit('internal:users.activity.' + type + ':count', sub_env);

      counts[type] = sub_env.count || 0;
    }));

    env.res.type = env.data.type;
    env.res.user_hid      = env.data.user.hid;
    env.res.content_types = content_types;

    env.res.tabs = content_types.map(type => ({
      type,
      link: N.router.linkTo('users.activity', {
        user_hid: env.data.user.hid,
        type
      }),
      count: counts[type]
    }));
  });


  // Get user activity list
  //
  N.wire.on(apiPath, async function user_activity(env) {
    let sub_env = {
      params: {
        user_id:   env.data.user._id,
        user_info: env.user_info
      }
    };

    if (env.params.start) {
      // show the middle of the page, with some items before and after
      sub_env.params.start  = env.params.start;
      sub_env.params.before = Math.ceil(ITEMS_PER_PAGE / 2);
      sub_env.params.after  = ITEMS_PER_PAGE;
    } else {
      // show first page
      sub_env.params.start  = null;
      sub_env.params.before = 0;
      sub_env.params.after  = ITEMS_PER_PAGE;
    }

    await N.wire.emit('internal:users.activity.' + env.data.type, sub_env);

    env.res.results        = sub_env.results;
    env.res.reached_top    = sub_env.reached_top;
    env.res.reached_bottom = sub_env.reached_bottom;

    env.res.items_per_page = ITEMS_PER_PAGE;
    env.data.users = (env.data.users || []).concat(sub_env.users);
  });


  // Fill head meta
  //
  N.wire.after(apiPath, function fill_head(env) {
    let user = env.data.user;

    env.res.head = env.res.head || {};
    env.res.head.title = env.t('title_with_user', { user: env.user_info.is_member ? user.name : user.nick });
  });


  // Fill breadcrumbs
  //
  N.wire.after(apiPath, async function fill_breadcrumbs(env) {
    await N.wire.emit('internal:users.breadcrumbs.fill_albums', env);

    env.res.breadcrumbs = env.data.breadcrumbs.slice(0, -1);
  });
};
