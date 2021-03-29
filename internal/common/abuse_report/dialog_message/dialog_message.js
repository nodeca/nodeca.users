// Extend `internal:common.abuse_report` to send abuse report for type `DIALOG_MESSAGE`
//
// In:
//
// - report - N.models.core.AbuseReport
//
// Out:
//
// - recipients - { user_id: user_info }
// - locals - rendering data
// - subject_email
// - subject_log
// - template
//
'use strict';


const _        = require('lodash');
const userInfo = require('nodeca.users/lib/user_info');


module.exports = function (N, apiPath) {

  // Subcall `internal:common.abuse_report` for `DIALOG_MESSAGE` content type
  //
  N.wire.on('internal:common.abuse_report', async function dialog_message_abuse_report_subcall(params) {
    if (params.report.type === N.shared.content_type.DIALOG_MESSAGE) {
      params.data = params.data || {};
      await N.wire.emit('internal:common.abuse_report.dialog_message', params);
    }
  });


  // Fetch dialog message
  //
  N.wire.before(apiPath, async function fetch_message(params) {
    params.data.message = await N.models.users.DlgMessage.findById(params.report.src).lean(true);

    if (!params.data.message) throw N.io.NOT_FOUND;

    params.data.dialog = await N.models.users.Dialog.findById(params.data.message.parent).lean(true);

    if (!params.data.dialog) throw N.io.NOT_FOUND;
  });


  // Fetch recipients
  //
  N.wire.before(apiPath, async function fetch_recipients(params) {
    // send message to all users with infraction permissions
    let groups = await N.models.users.UserGroup.find().select('_id');

    let allowed_groups = [];

    for (let usergroup of groups) {
      let params = {
        usergroup_ids: [ usergroup._id ]
      };

      let can_add_infractions = await N.settings.get('users_mod_can_add_infractions_dialogs', params, {});

      if (can_add_infractions) allowed_groups.push(usergroup._id);
    }

    let recipients = await N.models.users.User.find()
                               .where('usergroups').in(allowed_groups)
                               .select('_id')
                               .lean(true);

    let user_infos = await userInfo(N, _.map(recipients, '_id'));

    let allowed_userinfos = {};

    // double-check all permissions in case a user is disallowed from another
    // group with force=true
    for (let user_id of Object.keys(user_infos)) {
      let user_info = user_infos[user_id];

      let params = {
        user_id: user_info.user_id,
        usergroup_ids: user_info.usergroups
      };

      let can_add_infractions = await N.settings.get('users_mod_can_add_infractions_dialogs', params, {});

      if (can_add_infractions) allowed_userinfos[user_id] = user_info;
    }

    params.recipients = allowed_userinfos;
  });


  // Prepare locals
  //
  N.wire.on(apiPath, async function prepare_locals(params) {
    let locals = params.locals || {};
    let author = params.report.from ? await userInfo(N, params.report.from) : null;

    const TEMPLATE_PATH = 'common.abuse_report.dialog_message';

    params.subject_log   = `${TEMPLATE_PATH}.subject_log`;
    params.subject_email = `${TEMPLATE_PATH}.subject_email`;
    params.template      = TEMPLATE_PATH;

    locals.project_name = await N.settings.get('general_project_name');
    locals.report_text = params.report.text;
    locals.src_url = N.router.linkTo('users.dialog', {
      dialog_id:  params.data.dialog._id,
      message_id: params.data.message._id
    });
    locals.src_text = params.data.message.md;

    // calculate minimum backtick length for ````quote, so it would encapsulate
    // original content (longest backtick sequence plus 1, but at least 3)
    let backtick_seq_len = Math.max.apply(
      null,
      ('`` ' + locals.report_text + ' ' + locals.src_text)
        .match(/`+/g) //`
        .map(s => s.length)
      ) + 1;

    locals.backticks = '`'.repeat(backtick_seq_len);

    if (author) {
      locals.author = author;
      locals.author_link = N.router.linkTo('users.member', { user_hid: author.user_hid });
    }

    params.locals = locals;
  });
};
