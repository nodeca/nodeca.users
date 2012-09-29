'use strict';


/**
 *  client
 **/

/**
 *  client.common
 **/

/**
 *  client.common.auth
 **/


/*global $, _, nodeca, window*/


/**
 *  client.common.auth.check_nick($elem, event)
 *
 *  send nick value on server
 *  and show error if nick exists
 **/
module.exports.check_nick = function($elem, event) {
  var nick = $elem.val();
  nodeca.server.users.auth.register.check_nick({nick: nick}, function(err, request){
    var $group = $elem.parents('.control-group:first');
    var message;

    if (err) {
      if (err.statusCode === 409) {
        $group.addClass('error');

        message = err.message['nick'];
        $elem.parent().find('.help-block').text(message);
        return;
      }
      message = nodeca.runtime.t('common.notice.internal_server_error');
      nodeca.client.common.notice.show(message);
      return;
    }

    if ($group.hasClass('error')) {
      $group.removeClass('error');

      message = nodeca.runtime.t('users.auth.reg_form.nick_help');
      $elem.parent().find('.help-block').text(message);
    }
  });
  return false;
};
