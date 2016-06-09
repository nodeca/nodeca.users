'use strict';


const _ = require('lodash');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true }
  });

  let blocks = _.map(
    N.config.users.profile_page.blocks,
    (v, k) => _.assign({ name: k }, v)
  );
  blocks = _.sortBy(blocks, _.property('priority'));

  let menu = _.map(
    N.config.users.profile_page.menu,
    (v, k) => _.assign({ name: k }, v)
  );
  menu = _.sortBy(menu, _.property('priority'));


  // Fetch member by 'user_hid'
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env) {
    return N.wire.emit('internal:users.fetch_user_by_hid', env);
  });


  // Fill actions
  //
  N.wire.before(apiPath, function fill_actions(env) {
    if (env.user_info.is_guest) {
      env.data.actions = [];
      return;
    }

    let actions = _.map(
      N.config.users.profile_page.actions,
      (v, k) => _.assign({ name: k }, v)
    );

    env.data.actions = _.sortBy(actions, _.property('priority'));
  });


  // Fill penalty info
  //
  N.wire.before(apiPath, function* fill_penalty_info(env) {
    let penalty = yield N.models.users.UserPenalty.findOne()
                            .where('user').equals(env.data.user._id)
                            .lean(true);

    if (penalty && penalty.expire) {
      env.res.penalty_expire = penalty.expire;
    }
  });


  // Check if this user is ignored
  //
  N.wire.before(apiPath, function* check_ignore(env) {
    let ignore = yield N.models.users.Ignore.findOne()
                           .where('from').equals(env.user_info.user_id)
                           .where('to').equals(env.data.user._id)
                           .lean(true);

    if (ignore) {
      env.res.user_is_ignored = true;
    }

    let cannot_be_ignored = yield N.settings.get('cannot_be_ignored', {
      user_id: env.data.user._id,
      usergroup_ids: env.data.user.usergroups
    }, {});


    if (cannot_be_ignored || String(env.data.user._id) === env.user_info.user_id) {
      // Remove ignore action if user can't be ignored or it's own page
      env.data.actions = env.data.actions.filter(action => action.name !== 'ignore');
    }
  });


  // Check user can hellban
  //
  N.wire.before(apiPath, function* check_hellban(env) {
    let can_see_hellbanned = yield env.extras.settings.fetch('can_see_hellbanned');

    if (can_see_hellbanned) {
      env.res.user_is_hb = env.data.user.hb;
    }

    let can_hellban = yield env.extras.settings.fetch('can_hellban');

    if (!can_hellban || String(env.data.user._id) === env.user_info.user_id) {
      // Remove hellban action if user can't hellban or it's own page
      env.data.actions = env.data.actions.filter(action => action.name !== 'hellban');
    }
  });


  // Update activity info with fresh data if available
  //
  N.wire.before(apiPath, function* fetch_activity_info(env) {
    if (String(env.data.user._id) === env.user_info.user_id) {
      // User is viewing its own profile. Since redis last_active_ts is not
      // yet updated, just show her the current redis time.
      //
      let time = yield N.redis.timeAsync();

      env.data.user.last_active_ts = new Date(Math.floor(time[0] * 1000 + time[1] / 1000));
      return;
    }

    let score = yield N.redis.zscoreAsync('users:last_active', String(env.data.user._id));

    // Score not found, use `last_active_ts` from mongodb
    if (!score) {
      return;
    }

    // Use fresh `last_active_ts` from redis
    env.data.user.last_active_ts = new Date(parseInt(score, 10));
  });


  // Fill permissions to use messages
  //
  N.wire.before(apiPath, function* fill_messages_permissions(env) {
    env.res.settings = yield env.extras.settings.fetch([
      'can_use_messages',
      'can_send_messages'
    ]);
  });


  // Fill response
  //
  N.wire.on(apiPath, function* fetch_user_by_hid(env) {
    env.res.user = {};
    env.res.user._id = env.data.user._id;
    env.res.user.hid = env.data.user.hid;
    env.res.user.last_active_ts = env.data.user.last_active_ts;

    env.res.avatar_exists = env.data.user.avatar_id ? true : false;

    let can_use_messages = yield env.extras.settings.fetch('can_use_messages');

    env.res.menu_ordered = menu.filter(item => {
      // Show "Messages" menu item only if permitted
      if (item.to === 'users.dialogs_root') return can_use_messages;
      return true;
    });
    env.res.blocks_ordered = blocks;

    env.data.users = env.data.users || [];
    env.data.users.push(env.data.user._id);
  });


  // Fill head and breadcrumbs
  //
  N.wire.after(apiPath, function* fill_head_and_breadcrumbs(env) {
    let user = env.data.user;
    let name = env.user_info.is_member ? user.name : user.nick;

    env.res.head = env.res.head || {};
    env.res.head.title = name;


    yield N.wire.emit('internal:users.breadcrumbs.fill_user', env);

    // Doesn't show avatar in breadcrumbs on member page
    env.data.breadcrumbs[0].show_avatar = false;

    env.res.breadcrumbs = env.data.breadcrumbs;
  });


  // Stub for unimplemented blocks
  //
  N.wire.after(apiPath, function stub(env) {
    _.set(env, 'res.blocks.bookmarks', {});
    _.set(env, 'res.blocks.friends', {});
    _.set(env, 'res.blocks.blog', {});
  });


  // Fill actions (blocks could change `env.data.actions`)
  //
  N.wire.after(apiPath, { priority: 100 }, function fill_actions(env) {
    // If last item is divider - remove it
    if (env.data.actions.length && env.data.actions[env.data.actions.length - 1].name === 'mod_divider') {
      env.data.actions.pop();
    }

    env.res.actions_ordered = env.data.actions;
  });
};
