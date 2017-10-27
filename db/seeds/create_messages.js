// Create demo dialogs for admin
//
'use strict';


const _         = require('lodash');
const charlatan = require('charlatan');
const ObjectId  = require('mongoose').Types.ObjectId;


const USER_COUNT           = 50;
const MSG_COUNT_IN_BIG_DLG = 200;
const MIN_MSG_COUNT        = 1;
const MAX_MSG_COUNT        = 5;


let models;
let settings;
let parser;


let users = [];
let msg_day = 0;
let markup_options;


async function createDemoUsers() {
  for (let i = 0; i < USER_COUNT; i++) {
    let user = new models.users.User({
      first_name: charlatan.Name.firstName(),
      last_name:  charlatan.Name.lastName(),
      nick:       charlatan.Internet.userName(),
      email:      charlatan.Internet.email(),
      joined_ts:  new Date()
    });

    await user.save();

    // add user to store
    users.push(user);
  }
}


async function createMessages(dlg1, dlg2, msg_count) {
  if (msg_count <= 0) return;

  let msg1, msg2, md;

  for (let i = 0; i < msg_count; i++) {
    md = charlatan.Lorem.paragraphs(charlatan.Helpers.rand(5, 1)).join('\n\n');

    let result = await parser.md2html({
      text: md,
      attachments: [],
      options: markup_options
    });
    let ts = new Date(2010, 0, msg_day++);

    let msg_data = {
      user: Math.random() > 0.5 ? dlg1.user : dlg2.user,
      ts,
      /*eslint-disable new-cap*/
      ip:   charlatan.Internet.IPv4(),
      md,
      html: result.html
    };

    msg1 = new models.users.DlgMessage(_.assign({
      _id: new ObjectId(Math.round(ts / 1000)),
      parent: dlg1._id
    }, msg_data));

    msg2 = new models.users.DlgMessage(_.assign({
      _id: new ObjectId(Math.round(ts / 1000)),
      parent: dlg2._id
    }, msg_data));

    await Promise.all([ msg1.save(), msg2.save() ]);
  }

  let preview_data = await parser.md2preview({ text: md, limit: 250, link2text: true });

  dlg1.cache = {
    last_user:    msg1.user,
    last_ts:      msg1.ts,
    is_reply:     String(msg1.user) === String(dlg1.user),
    preview:      preview_data.preview,
    last_message: msg1._id
  };

  dlg2.cache = {
    last_user:    msg2.user,
    last_ts:      msg2.ts,
    is_reply:     String(msg2.user) === String(dlg2.user),
    preview:      preview_data.preview,
    last_message: msg2._id
  };
}


async function createDialogs(owner) {
  let opponents = charlatan.Helpers.shuffle(users);

  for (let i = 0; i < opponents.length; i++) {
    let opponent = opponents[i];
    let dlg_data = {};

    let own = new models.users.Dialog(_.assign({
      user: owner._id,
      to: opponent._id
    }, dlg_data));

    let opp = new models.users.Dialog(_.assign({
      user: opponent._id,
      to: owner._id
    }, dlg_data));

    // The last dialog will be big
    let msg_count = i === opponents.length - 1 ?
                    MSG_COUNT_IN_BIG_DLG :
                    charlatan.Helpers.rand(MIN_MSG_COUNT, MAX_MSG_COUNT);

    await createMessages(own, opp, msg_count);
    await Promise.all([ own.save(), opp.save() ]);
  }
}


module.exports = async function (N) {
  models   = N.models;
  settings = N.settings;
  parser   = N.parser;

  // Get administrators group _id
  let adm_group_id = await models.users.UserGroup.findIdByName('administrators');

  let users = await models.users.User.find()
                      .where('usergroups').equals(adm_group_id)
                      .select('_id')
                      .lean(true);

  if (!users.length) return;

  markup_options = await settings.getByCategory(
    'dialogs_markup',
    { usergroup_ids: [ adm_group_id ] },
    { alias: true }
  );

  await createDemoUsers();
  await Promise.all(users.map(u => createDialogs(u)));
};
