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
// - email_templates - { body, subject }
// - log_templates - { body, subject }
//
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
    // send message to all administrators
    let admin_group_id = await N.models.users.UserGroup.findIdByName('administrators');

    let recipients = await N.models.users.User.find()
                               .where('usergroups').equals(admin_group_id)
                               .select('_id')
                               .lean(true);

    let recipients_ids = _.map(recipients, '_id');

    params.recipients = await userInfo(N, recipients_ids);
  });


  // Prepare locals
  //
  N.wire.on(apiPath, async function prepare_locals(params) {
    let locals = params.locals || {};
    let author = params.report.from ? await userInfo(N, params.report.from) : null;

    params.log_templates = {
      body: 'common.abuse_report.dialog_message.log_templates.body',
      subject: 'common.abuse_report.dialog_message.log_templates.subject'
    };

    params.email_templates = {
      body: 'common.abuse_report.dialog_message.email_templates.body',
      subject: 'common.abuse_report.dialog_message.email_templates.subject'
    };

    locals.project_name = await N.settings.get('general_project_name');
    locals.report_text = params.report.text;
    locals.src_url = N.router.linkTo('users.dialog', {
      dialog_id:  params.data.dialog._id,
      message_id: params.data.message._id
    });
    locals.src_text = params.data.message.md;
    locals.src_html = params.data.message.html;
    locals.recipients = _.values(params.recipients);

    if (author) locals.author = author;

    params.locals = locals;
  });
};
