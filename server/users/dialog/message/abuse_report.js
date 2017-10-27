// Send abuse report
//
'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {
    // DlgMessage._id
    message_id: { format: 'mongo', required: true },
    // abuse report text
    message:    { type: 'string', required: true }
  });


  // Check auth
  //
  N.wire.before(apiPath, function check_auth(env) {
    if (!env.user_info.is_member) throw N.io.FORBIDDEN;
  });


  // Check permissions
  //
  N.wire.before(apiPath, async function check_permissions(env) {
    let can_report_abuse = await env.extras.settings.fetch('can_report_abuse');

    if (!can_report_abuse) throw N.io.FORBIDDEN;
  });


  // Fetch dialog and message
  //
  N.wire.before(apiPath, async function fetch_dialog(env) {
    // permission checks are inside mongodb queries:
    //  - restrict to dialog owned by current user
    //  - make sure message is visible (not deleted)
    //  - make sure dialog is visible (not deleted)
    let dlg_message = await N.models.users.DlgMessage.findOne()
                            .where('exists').equals(true)
                            .where('_id').equals(env.params.message_id)
                            .lean(true);

    if (!dlg_message) throw N.io.NOT_FOUND;

    let dialog = await N.models.users.Dialog.findOne()
                          .where('user').equals(env.user_info.user_id)
                          .where('exists').equals(true)
                          .where('_id').equals(dlg_message.parent)
                          .lean(true);

    if (!dialog) throw N.io.NOT_FOUND;

    env.data.dialog = dialog;
    env.data.dlg_message = dlg_message;
  });


  // Send abuse report
  //
  N.wire.on(apiPath, async function send_report_subcall(env) {
    env.data.message = env.params.message;

    let params = await N.models.core.MessageParams.getParams(env.data.message.params_ref);

    // enable markup used in templates (even if it's disabled in dialogs)
    params.link  = true;
    params.quote = true;

    let report = new N.models.core.AbuseReport({
      src: env.data.dlg_message._id,
      type: N.shared.content_type.DIALOG_MESSAGE,
      text: env.params.message,
      from: env.user_info.user_id,
      params_ref: await N.models.core.MessageParams.setParams(params)
    });

    await N.wire.emit('internal:common.abuse_report', { report });
  });


  // Mark user as active
  //
  N.wire.after(apiPath, function set_active_flag(env) {
    return N.wire.emit('internal:users.mark_user_active', env);
  });
};
