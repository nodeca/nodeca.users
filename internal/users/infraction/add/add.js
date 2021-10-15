// - apply penalty action if needed
// - notify user via PM (via dialogs)
//
'use strict';


const ObjectId = require('mongoose').Types.ObjectId;
const userInfo = require('nodeca.users/lib/user_info');


module.exports = function (N, apiPath) {

  // Apply penalty action if needed
  //
  N.wire.on(apiPath, async function apply_penalty(infraction) {
    let penalties = N.config.users?.infractions?.penalties || [];
    // Rules sorted by `points` in desc order
    let rules = penalties.sort((a, b) => b.points - a.points);

    let infractions = await N.models.users.Infraction.find()
                                .where('for').equals(infraction.for)
                                .where('exists').equals(true)
                                .or([ { expire: null }, { expire: { $gt: Date.now() } } ])
                                .select('points')
                                .lean(true);

    let total_points = infractions.map(i => i.points).reduce((a, b) => a + b, 0);

    // Find rule with maximum points
    rules = rules.filter(rule => rule.points <= total_points);

    if (!rules.length) return;

    let apply_rule = rules.reduce((a, b) => (a.points >= b.points ? a : b));

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

    if (info_env.info[infraction.src]?.url) {
      let original_message = N.i18n.t(locale, 'users.infraction.add.original_message');

      message_url = `[${original_message}](${info_env.info[infraction.src].url})`;
    }


    // Wrap message text to quote
    //
    let message_text = '';

    if (info_env.info[infraction.src]?.text) {
      // Calculate apostrophes count for quote wrapper
      //
      // - get string from message with longest apostrophes sequence
      // - apostrophes count is length + 1 (but always more than 3)
      //
      let max_apostrophes = (info_env.info[infraction.src].text.match(/`+/gm) || []) //`
                              .reduce((a, b) => (a.length >= b.length ? a : b), '');
      let apostrophes_length = Math.max(max_apostrophes ? (max_apostrophes.length + 1) : 0, 3);
      let apostrophes = '`'.repeat(apostrophes_length);

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
      options,
      user_info: to
    });

    // Prepare message and dialog data
    //
    let message_data = {
      common_id:    new ObjectId(),
      ts:           Date.now(),
      html:         parse_result.html,
      md:           text,
      params:       options,
      imports:      parse_result.imports,
      import_users: parse_result.import_users
    };

    // Find opponent's dialog, create if doesn't exist
    //
    let opponent_dialog = await N.models.users.Dialog.findOne({
      user: infraction.for,
      with: bot._id
    });

    if (!opponent_dialog) {
      opponent_dialog = new N.models.users.Dialog({
        user: infraction.for,
        with: bot._id
      });
    }

    let opponent_msg = new N.models.users.DlgMessage(Object.assign({
      parent: opponent_dialog._id,
      user: infraction.for,
      with: bot._id,
      incoming: true
    }, message_data));

    // params should be passed separately and will be converted by hooks to params_ref
    opponent_msg.params = message_data.params;

    opponent_dialog.unread = true;
    // cache will be generated in updateSummary later, this is only here to stop race conditions
    opponent_dialog.cache.last_message = opponent_msg._id;

    await opponent_msg.save();
    await opponent_dialog.save();
    await N.models.users.Dialog.updateSummary(opponent_dialog._id);

    // Notify user
    //
    let dialogs_notify = await N.settings.get('dialogs_notify', { user_id: opponent_dialog.user });

    if (dialogs_notify) {
      await N.wire.emit('internal:users.notify', {
        src:  opponent_dialog._id,
        type: 'USERS_MESSAGE'
      });
    }
  });
};
