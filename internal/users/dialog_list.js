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
//       last_messages: {}
//       settings: {}
//       last_dialog_id
//     data:
//       dialogs: []
//       last_messages: {}
//       settings: {}
//
'use strict';


const _ = require('lodash');


module.exports = function (N, apiPath) {

  // Fetch and fill permissions
  //
  N.wire.before(apiPath, function* fetch_and_fill_permissions(env) {
    env.res.settings = env.data.settings = yield env.extras.settings.fetch([
      'can_use_messages',
      'can_send_messages'
    ]);
  });


  // Check permissions
  //
  N.wire.before(apiPath, function check_permissions(env) {
    if (env.user_info.is_guest) throw N.io.NOT_FOUND;
    if (!env.data.settings.can_use_messages) throw N.io.NOT_FOUND;
  });


  // Get dialogs ids
  //
  N.wire.before(apiPath, function* get_dialogs_ids(env) {
    yield env.data.build_dialogs_ids(env);
  });


  // Fetch and sort dialogs
  //
  N.wire.on(apiPath, function* fetch_and_sort_dialogs(env) {
    let dialogs = yield N.models.users.Dialog.find()
                            .where('user').equals(env.user_info.user_id)
                            .where('exists').equals(true)
                            .where('_id').in(env.data.dialogs_ids)
                            .lean(true);

    env.data.dialogs = [];

    // Sort in `env.data.dialogs_ids` order.
    // May be slow on large volumes
    env.data.dialogs_ids.forEach(id => {
      let dlg = _.find(dialogs, d => d._id.equals(id));

      if (dlg) {
        env.data.dialogs.push(dlg);
      }
    });

    // Fill dialogs
    env.res.dialogs = env.data.dialogs;
  });


  // Fill last dialog _id
  //
  N.wire.after(apiPath, function* fill_last_dialog(env) {
    let last_dlg = yield N.models.users.Dialog.findOne()
                            .where('user').equals(env.user_info.user_id)
                            .where('exists').equals(true)
                            .sort('last_message')
                            .select('_id')
                            .lean(true);

    env.res.last_dialog_id = last_dlg ? last_dlg._id : null;
  });


  // Fetch last messages
  //
  N.wire.after(apiPath, function* fetch_last_messages(env) {
    let messages = yield N.models.users.DlgMessage.find()
                            .where('_id').in(_.map(env.data.dialogs, 'last_message'))
                            .lean(true);

    env.res.last_messages = env.data.last_messages = _.keyBy(messages, '_id');
  });


  // Collect users
  //
  N.wire.after(apiPath, function collect_users(env) {
    env.data.users = env.data.users || [];

    env.data.dialogs.forEach(dlg => {
      env.data.users.push(dlg.to);
    });

    _.forEach(env.data.last_messages, msg => {
      env.data.users.push(msg.user);
    });
  });
};
