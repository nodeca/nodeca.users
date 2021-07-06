// Get dialog list with all data needed to render
//
// in:
//
// - env.data.build_dialogs_ids (env, callback) - should fill `env.data.dialogs_ids` with correct sorting order
//
// out:
//
//   env:
//     res:
//       users: []
//       dialogs: []
//       settings: {}
//       last_dialog_id
//     data:
//       dialogs: []
//       settings: {}
//
'use strict';


module.exports = function (N, apiPath) {

  // Fetch and fill permissions
  //
  N.wire.before(apiPath, async function fetch_and_fill_permissions(env) {
    env.res.settings = env.data.settings = await env.extras.settings.fetch([
      'can_use_dialogs',
      'can_create_dialogs'
    ]);
  });


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env) {
    if (!env.user_info.is_member) throw N.io.NOT_FOUND;
    if (!env.data.settings.can_use_dialogs) throw N.io.NOT_FOUND;
  });


  // Get dialogs ids
  //
  N.wire.before(apiPath, async function get_dialogs_ids(env) {
    await env.data.build_dialogs_ids(env);
  });


  // Fetch and sort dialogs
  //
  N.wire.on(apiPath, async function fetch_and_sort_dialogs(env) {
    let dialogs = await N.models.users.Dialog.find()
                            .where('user').equals(env.data.user._id)
                            .where('exists').equals(true)
                            .where('_id').in(env.data.dialogs_ids)
                            .lean(true);

    env.data.dialogs = [];

    // Sort in `env.data.dialogs_ids` order.
    // May be slow on large volumes
    env.data.dialogs_ids.forEach(id => {
      let dlg = dialogs.find(d => d._id.equals(id));

      if (dlg) {
        env.data.dialogs.push(dlg);
      }
    });

    // Fill dialogs
    env.res.dialogs = env.data.dialogs;
  });


  // Fill last dialog _id
  //
  N.wire.after(apiPath, async function fill_last_dialog(env) {
    let query = N.models.users.Dialog.findOne()
                    .where('user').equals(env.data.user._id)
                    .where('exists').equals(true)
                    .sort('cache.last_message')
                    .select('_id')
                    .lean(true);

    if (env.data.dialogs_hide_answered) query = query.where('cache.is_reply').equals(false);

    let last_dlg = await query.lean(true);

    env.res.last_dialog_id = last_dlg?._id;
  });


  // Collect users
  //
  N.wire.after(apiPath, function collect_users(env) {
    env.data.users = env.data.users || [];

    env.data.dialogs.forEach(dlg => {
      env.data.users.push(dlg.with);
      env.data.users.push(dlg.cache.last_user);
    });
  });
};
