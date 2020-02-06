// Add infraction to user
//
'use strict';


const _        = require('lodash');
const userInfo = require('nodeca.users/lib/user_info');


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    message_id:  { format: 'mongo', required: true },
    type:        { type: 'string', required: true },
    expire:      { type: 'integer', required: true },
    points:      { type: 'integer', required: true },
    reason:      { type: 'string' }
  });


  // Additional type validation
  //
  N.wire.before(apiPath, function validate_type(env) {
    let types = _.get(N.config, 'users.infractions.types', {});

    if (env.params.type === 'custom') {
      if (!env.params.reason) throw N.io.BAD_REQUEST;
    } else if (!types[env.params.type]) throw N.io.BAD_REQUEST;
  });


  // Check is member
  //
  N.wire.before(apiPath, function check_is_member(env) {
    if (!env.user_info.is_member) throw N.io.NOT_FOUND;
  });


  // Fetch message, try to fetch sender's copy if possible
  //
  N.wire.before(apiPath, async function fetch_message(env) {
    let message = await N.models.users.DlgMessage.findById(env.params.message_id)
                                .lean(true);

    if (!message || !message.common_id) throw N.io.NOT_FOUND;

    let all_copies = await N.models.users.DlgMessage.find()
                               .where('common_id').equals(message.common_id)
                               .lean(true);

    let sender_dialog = await N.models.users.Dialog.findOne()
                                  .where('_id').in(_.map(all_copies, 'parent'))
                                  .where('user').equals(message.user)
                                  .lean(true);

    if (!sender_dialog) throw N.io.NOT_FOUND;

    env.data.message = all_copies.find(msg => String(msg.parent) === String(sender_dialog._id));
  });


  // Check permissions
  //
  N.wire.before(apiPath, async function check_permissions(env) {
    let can_add_infractions_dialogs = await env.extras.settings.fetch('users_mod_can_add_infractions_dialogs');

    if (!can_add_infractions_dialogs) throw N.io.FORBIDDEN;

    let user_info = await userInfo(N, env.data.message.user);
    let params = {
      user_id: user_info.user_id,
      usergroup_ids: user_info.usergroups
    };
    let cannot_receive_infractions = await N.settings.get('cannot_receive_infractions', params, {});

    if (cannot_receive_infractions) throw { code: N.io.CLIENT_ERROR, message: env.t('err_perm_receive') };
  });


  // Check whether infraction already exists
  //
  N.wire.before(apiPath, async function check_exists(env) {
    let infraction = await N.models.users.Infraction.findOne()
                              .where('src').equals(env.data.message._id)
                              .where('exists').equals(true)
                              .lean(true);

    if (infraction) throw { code: N.io.CLIENT_ERROR, message: env.t('err_infraction_exists') };
  });


  // Save infraction
  //
  N.wire.on(apiPath, async function add_infraction(env) {
    let reason = env.params.reason;

    if (env.params.type !== 'custom') {
      // Save fallback data (if infraction type deleted from config)
      reason = env.t(`@users.infractions.types.${env.params.type}`);
    }

    let infraction = new N.models.users.Infraction({
      from: env.user_info.user_id,
      for: env.data.message.user,
      type: env.params.type,
      reason,
      points: env.params.points,
      src: env.data.message._id,
      src_type: N.shared.content_type.DIALOG_MESSAGE,
      src_common_id: env.data.message.common_id
    });

    if (env.params.expire > 0) {
      // Expire in days
      infraction.expire = new Date(Date.now() + (env.params.expire * 24 * 60 * 60 * 1000));
    }

    await infraction.save();
  });
};
