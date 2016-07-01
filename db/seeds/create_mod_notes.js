// Create demo moderator notes for admin
//
'use strict';


const co        = require('bluebird-co').co;
const charlatan = require('charlatan');


const NOTES_COUNT = 3;


let models;
let settings;
let parser;
let markup_options;


const createNotes = co.wrap(function* (to) {
  for (let i = 0; i < NOTES_COUNT; i++) {
    let from = new models.users.User({
      first_name: charlatan.Name.firstName(),
      last_name:  charlatan.Name.lastName(),
      nick:       charlatan.Internet.userName(),
      email:      charlatan.Internet.email(),
      joined_ts:  new Date()
    });

    yield from.save();

    let md = charlatan.Lorem.paragraphs(charlatan.Helpers.rand(3, 1)).join('\n\n');
    let parsed = yield parser.md2html({
      text: md,
      attachments: [],
      options: markup_options
    });

    let ts = new Date(2010, 0, i);

    let note = new models.users.ModeratorNote({
      from: from._id,
      to: to._id,
      md,
      html: parsed.html,
      ts
    });

    yield note.save();
  }
});


module.exports = co.wrap(function* (N) {
  models   = N.models;
  settings = N.settings;
  parser   = N.parser;

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

  yield users.map(u => createNotes(u));
});
