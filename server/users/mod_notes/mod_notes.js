'use strict';


const _ = require('lodash');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true }
  });


  // Check permissions
  //
  N.wire.before(apiPath, async function check_permissions(env) {
    if (!env.user_info.is_member) throw N.io.FORBIDDEN;

    let settings = env.res.settings = await env.extras.settings.fetch([
      'can_add_mod_notes',
      'can_delete_mod_notes',
      'mod_notes_edit_max_time'
    ]);

    if (!settings.can_add_mod_notes) throw N.io.NOT_FOUND;
  });


  // Fetch member by 'user_hid'
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env) {
    return N.wire.emit('internal:users.fetch_user_by_hid', env);
  });


  // Fill notes
  //
  N.wire.on(apiPath, async function fill_notes(env) {
    let notes = env.res.notes = await N.models.users.ModeratorNote.find()
                                          .where('to').equals(env.data.user._id)
                                          .sort({ ts: -1 })
                                          .lean(true);


    // Fetch users info
    //
    env.data.users = env.data.users || [];
    env.data.users = env.data.users.concat(_.map(notes, 'from'));
    env.data.users.push(env.data.user._id);


    env.res.user_id = env.data.user._id;
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
    await N.wire.emit('internal:users.breadcrumbs.fill_root', env);

    let user = env.data.user;

    env.data.breadcrumbs = env.data.breadcrumbs || [];

    env.data.breadcrumbs.push({
      text  : env.t('@users.mod_notes.breadcrumbs_title'),
      route : 'users.mod_notes',
      params: { user_hid: user.hid }
    });

    env.res.breadcrumbs = env.data.breadcrumbs;
  });
};
