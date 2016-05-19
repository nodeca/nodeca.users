// Create demo messages for admin
//
'use strict';


const co        = require('bluebird-co').co;
const _         = require('lodash');
const charlatan = require('charlatan');
const ObjectId  = require('mongoose').Types.ObjectId;


const USER_COUNT           = 5;
const DLG_COUNT            = 200;
const MSG_COUNT_IN_BIG_DLG = 200;
const MIN_MSG_COUNT        = 1;
const MAX_MSG_COUNT        = 5;


let models;
let settings;
let parser;


let users = [];
let msg_day = 0;
let markup_options;


const createDemoUsers = co.wrap(function* () {
  for (let i = 0; i < USER_COUNT; i++) {
    let user = new models.users.User({
      first_name: charlatan.Name.firstName(),
      last_name:  charlatan.Name.lastName(),
      nick:       charlatan.Internet.userName(),
      email:      charlatan.Internet.email(),
      joined_ts:  new Date()
    });

    yield user.save();

    // add user to store
    users.push(user);
  }
});


const createMessages = co.wrap(function* (dlg1, dlg2, msg_count) {
  for (let i = 0; i < msg_count; i++) {
    let md = charlatan.Lorem.paragraphs(charlatan.Helpers.rand(5, 1)).join('\n\n');
    let result = yield parser({
      text: md,
      attachments: [],
      options: markup_options
    });
    let ts = new Date(2010, 0, msg_day++);

    let msg_data = {
      user: Math.random() > 0.5 ? dlg1.user : dlg2.user,
      ts,
      md,
      html: result.html
    };

    let msg1 = new models.users.DlgMessage(_.assign({
      _id: new ObjectId(Math.round(ts / 1000)),
      parent: dlg1._id
    }, msg_data));

    dlg1.last_message = msg1._id;

    let msg2 = new models.users.DlgMessage(_.assign({
      _id: new ObjectId(Math.round(ts / 1000)),
      parent: dlg2._id
    }, msg_data));

    dlg2.last_message = msg2._id;

    yield [ msg1.save(), msg2.save() ];
  }
});


const createDialogs = co.wrap(function* (owner) {
  for (let i = 0; i < DLG_COUNT; i++) {
    let dlg_data = {
      common_id: new ObjectId(),
      title: charlatan.Lorem.sentence().slice(0, -1)
    };
    let opponent = users[charlatan.Helpers.rand(USER_COUNT)];

    let own = new models.users.Dialog(_.assign({
      user: owner._id,
      to: opponent._id
    }, dlg_data));

    let opp = new models.users.Dialog(_.assign({
      user: opponent._id,
      to: owner._id
    }, dlg_data));

    // The last dialog will be big
    let msg_count = (i === DLG_COUNT - 1) ? MSG_COUNT_IN_BIG_DLG : charlatan.Helpers.rand(MIN_MSG_COUNT, MAX_MSG_COUNT);

    yield createMessages(own, opp, msg_count);
    yield [ own.save(), opp.save() ];
  }
});


module.exports = co.wrap(function* (N) {
  models   = N.models;
  settings = N.settings;
  parser   = N.parse;

  // Get administrators group _id
  let adm_group_id = yield models.users.UserGroup.findIdByName('administrators');

  let users = yield models.users.User.find()
                      .where('usergroups').equals(adm_group_id)
                      .select('_id')
                      .lean(true);

  if (!users.length) return;

  markup_options = yield settings.getByCategory(
    'messages_markup',
    { usergroup_ids: [ adm_group_id ] },
    { alias: true }
  );

  yield createDemoUsers();
  yield users.map(u => createDialogs(u));
});
