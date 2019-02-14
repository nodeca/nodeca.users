// Delete dialogs associated with an account
//

'use strict';

const _ = require('lodash');


module.exports = function (N, apiPath) {
  N.validate(apiPath, {
    user_hid: { type: 'integer', minimum: 1, required: true }
  });


  // Fetch member by 'user_hid'
  //
  N.wire.before(apiPath, function fetch_user_by_hid(env) {
    return N.wire.emit('internal:users.fetch_user_by_hid', env);
  });


  // Delete dialogs
  //
  N.wire.on(apiPath, async function delete_dialogs(env) {
    let dialogs_from = await N.models.users.Dialog.find()
                                 .where({ user: env.data.user._id })
                                 .select('_id')
                                 .lean(true);

    await N.models.users.Dialog.updateMany(
      { _id: { $in: _.map(dialogs_from, '_id') } },
      { $set: { exists: false } }
    );

    await N.models.users.DlgMessage.updateMany(
      { parent: { $in: _.map(dialogs_from, '_id') } },
      { $set: { exists: false } }
    );

    let dialogs_to = await N.models.users.Dialog.find()
                               .where({ to: env.data.user._id })
                               .select('_id')
                               .lean(true);

    await N.models.users.Dialog.updateMany(
      { _id: { $in: _.map(dialogs_to, '_id') } },
      { $set: { exists: false } }
    );

    await N.models.users.DlgMessage.updateMany(
      { parent: { $in: _.map(dialogs_to, '_id') } },
      { $set: { exists: false } }
    );
  });
};
