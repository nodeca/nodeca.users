// - apply penalty action if needed
// - notify user via PM (via dialogs)
//
'use strict';


const _        = require('lodash');
const userInfo = require('nodeca.users/lib/user_info');
const ObjectId = require('mongoose').Types.ObjectId;


module.exports = function (N, apiPath) {

  // Apply penalty action if needed
  //
  N.wire.on(apiPath, function* apply_penalty(infraction) {
    let penalties = _.get(N.config, 'users.infractions.penalties', []);
    // Rules sorted by `points` in desc order
    let rules = penalties.sort((a, b) => b.points - a.points);

    let infractions = yield N.models.users.Infraction.find()
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
  N.wire.on(apiPath, function* notify_user(infraction) {
    let to = yield userInfo(N, infraction.for);
    let locale = to.locale || N.config.locales[0];


    // Subcall to fill url, text and title of content
    //
    let info_env = { infractions: [ infraction ], user_info: to, info: {} };

    yield N.wire.emit('internal:users.infraction.info', info_env);


    // Dialog title
    //
    let title = N.i18n.t(locale, 'users.infraction.add.title', infraction.points);


    // Fetch moderator nick
    //
    let moderator = yield N.models.users.User.findOne()
                              .where('_id').equals(infraction.from)
                              .select('nick')
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
      message_text
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

    let parse_result = yield N.parser.md2html({
      text,
      attachments: [],
      options,
      user_info: to
    });

    let preview_data = yield N.parser.md2preview({
      text,
      limit: 500,
      link2text: true
    });


    // Prepare message and dialog data
    //
    let message_data = {
      ts:           Date.now(),
      user:         infraction.from,
      html:         parse_result.html,
      md:           text,
      attach:       [],
      params:       options,
      imports:      parse_result.imports,
      import_users: parse_result.import_users,
      tail:         parse_result.tail
    };

    let dialog_data = {
      common_id: new ObjectId(),
      title,
      cache: {
        last_user: message_data.user,
        last_ts: message_data.ts,
        preview: preview_data.preview
      }
    };


    // Create moderator dialog and message
    //
    let from_dialog = new N.models.users.Dialog(_.merge({
      user: infraction.from,
      to:   infraction.for
    }, dialog_data));

    let from_msg = new N.models.users.DlgMessage(_.assign({
      parent: from_dialog._id
    }, message_data));

    from_dialog.cache.last_message = from_msg._id;
    from_dialog.cache.is_reply     = String(from_msg.user) === String(message_data.user);


    // Create violator dialog and message
    //
    let to_dialog = new N.models.users.Dialog(_.merge({
      user:   infraction.for,
      to:     infraction.from,
      unread: 1
    }, dialog_data));

    let to_msg = new N.models.users.DlgMessage(_.assign({
      parent: to_dialog._id
    }, message_data));

    to_dialog.cache.last_message = to_msg._id;
    to_dialog.cache.is_reply     = String(to_msg.user) === String(message_data.user);


    // Save dialogs and messages
    //
    yield [
      from_dialog.save(),
      from_msg.save(),
      to_dialog.save(),
      to_msg.save()
    ];


    // Notify user
    //
    let dialogs_notify = yield N.settings.get('dialogs_notify', { user_id: to_dialog.user });

    if (dialogs_notify) {
      yield N.wire.emit('internal:users.notify', {
        src:  to_dialog._id,
        to:   to_dialog.user,
        type: 'USERS_MESSAGE'
      });
    }
  });
};
