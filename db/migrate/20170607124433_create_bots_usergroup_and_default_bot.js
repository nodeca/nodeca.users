'use strict';


exports.up = async function (N) {
  let usergroup = await new N.models.users.UserGroup({
    short_name:   'bots',
    is_protected: true
  }).save();

  let hid = N.config.bots.default_bot_hid;

  if (await N.models.users.User.findOne({ hid })) {
    throw new Error(`Can't create default bot: user ${hid} already exists`);
  }

  await new N.models.users.User({
    hid,
    nick:       'autopilot',
    email:      'no_reply@localhost',
    usergroups: [ usergroup._id ]
  }).save();

  await N.models.core.Increment.next('user');
};
