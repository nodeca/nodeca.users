// - apply penalty action if needed
// - notify user via PM (via dialogs)
//
'use strict';


const _        = require('lodash');
const ObjectId = require('mongoose').Types.ObjectId;
const userInfo = require('nodeca.users/lib/user_info');


module.exports = function (N, apiPath) {

  // Apply penalty action if needed
  //
  N.wire.on(apiPath, async function apply_penalty(infraction) {
    let penalties = _.get(N.config, 'users.infractions.penalties', []);
    // Rules sorted by `points` in desc order
    let rules = penalties.sort((a, b) => b.points - a.points);

    let infractions = await N.models.users.Infraction.find()
                                .where('for').equals(infraction.for)
                                .where('exists').equals(true)
                                .or([ { expire: null }, { expire: { $gt: Date.now() } } ])
                                .select('points')
                                .lean(true);

    let total_points = _.sumBy(infractions, 'points');
    let apply_rule;

    // Find rule with maximum points
    apply_rule = _.maxBy(rules.filter(rule => rule.points <= total_points), rule => rule.points);

    if (!apply_rule) return;

    return N.wire.emit(`internal:users.infraction.${apply_rule.action}.add`, {
      infraction,
      action_data: apply_rule.action_data
    });
  });


  // Notify user via PM (via dialogs)
  //
  N.wire.on(apiPath, async function notify_user(infraction) {
    let to = await userInfo(N, infraction.for);
    let locale = to.locale || N.config.locales[0];


    // Subcall to fill url, text and title of content
    //
    let info_env = { infractions: [ infraction ], user_info: to, info: {} };

    await N.wire.emit('internal:users.infraction.info', info_env);


    // Fetch moderator nick
    //
    let moderator = await N.models.users.User.findOne()
                              .where('_id').equals(infraction.from)
                              .select('nick')
                              .lean(true);

    // Fetch user to send messages from
    //
    let bot = await N.models.users.User.findOne()
                        .where('hid').equals(N.config.bots.default_bot_hid)
                        .lean(true);

    // Infraction description
    //
    let desc_i18n_path = 'users.infractions.types_description.' + infraction.type;
    let description = N.i18n.hasPhrase(locale, desc_i18n_path) ? N.i18n.t(locale, desc_i18n_path) : '';


    // Url to original message
    //
    let message_url = '';

    if (info_env.info[infraction.src] && info_env.info[infraction.src].url) {
      let original_message = N.i18n.t(locale, 'users.infraction.add.original_message');

      message_url = `[${original_message}](${info_env.info[infraction.src].url})`;
    }


    // Wrap message text to quote
    //
    let message_text = '';

    if (info_env.info[infraction.src] && info_env.info[infraction.src].text) {
      // Calculate apostrophes count for quote wrapper
      //
      // - get string from message with longest apostrophes sequence
      // - apostrophes count is length + 1 (but always more than 3)
      //
      let max_apostrophes = _.maxBy(info_env.info[infraction.src].text.match(/`+/gm) || [], str => str.length);
      let apostrophes_length = Math.max(max_apostrophes ? (max_apostrophes.length + 1) : 0, 3);
      let apostrophes = _.repeat('`', apostrophes_length);

      message_text = `${apostrophes}quote\n${info_env.info[infraction.src].text}\n${apostrophes}`;
    }


    // Render message text
    //
    let text = N.i18n.t(locale, 'users.infraction.add.text', {
      nick: moderator.nick,
      points: infraction.points,
      reason: infraction.reason || N.i18n.t(locale, 'users.infractions.types.' + infraction.type),
      description,
      message_url,
      message_text,
      infraction_link: N.router.linkTo('users.member', { user_hid: to.user_hid }) +
                       '#infraction' + infraction._id
    });

    let options = {
      code:           true,
      emoji:          true,
      emphasis:       true,
      heading:        true,
      hr:             true,
      image:          true,
      link:           true,
      link_to_title:  true,
      list:           true,
      quote:          true,
      quote_collapse: true,
      sub:            true,
      sup:            true
    };

    let parse_result = await N.parser.md2html({
      text,
      attachments: [],
      options,
      user_info: to
    });

    let preview_data = await N.parser.md2preview({
      text,
      limit: 500,
      link2text: true
    });


    // Prepare message and dialog data
    //
    let message_data = {
      common_id:    new ObjectId(),
      ts:           Date.now(),
      user:         bot._id,
      html:         parse_result.html,
      md:           text,
      attach:       [],
      params:       options,
      imports:      parse_result.imports,
      import_users: parse_result.import_users,
      tail:         parse_result.tail
    };

    let dlg_update_data = {
      exists: true, // force dialog to re-appear if it was deleted
      cache: {
        last_user: message_data.user,
        last_ts: message_data.ts,
        preview: preview_data.preview
      }
    };

    // Find opponent's dialog, create if doesn't exist
    //
    let opponent_dialog = await N.models.users.Dialog.findOne({
      user: infraction.for,
      to:   bot._id
    });

    if (!opponent_dialog) {
      opponent_dialog = new N.models.users.Dialog({
        user: infraction.for,
        to:   bot._id
      });
    }

    _.merge(opponent_dialog, dlg_update_data);

    let opponent_msg = new N.models.users.DlgMessage(_.assign({
      parent: opponent_dialog._id
    }, message_data));

    opponent_dialog.unread = (opponent_dialog.unread || 0) + 1;
    opponent_dialog.cache.last_message = opponent_msg._id;
    opponent_dialog.cache.is_reply     = String(opponent_msg.user) === String(message_data.user);


    // Save dialogs and messages
    //
    await Promise.all([
      opponent_dialog.save(),
      opponent_msg.save()
    ]);


    // Notify user
    //
    let dialogs_notify = await N.settings.get('dialogs_notify', { user_id: opponent_dialog.user });

    if (dialogs_notify) {
      await N.wire.emit('internal:users.notify', {
        src:  opponent_dialog._id,
        to:   opponent_dialog.user,
        type: 'USERS_MESSAGE'
      });
    }
  });
};
