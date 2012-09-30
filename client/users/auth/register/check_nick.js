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

/**
 *  client.common.auth.register
 **/


/*global $, _, nodeca, window*/


/**
 *  client.common.auth.register.check_nick($elem, event)
 *
 *  send nick value on server
 *  and show error if nick exists
 **/
module.exports = function ($elem, event) {
  var nick = $elem.val();

  nodeca.server.users.auth.register.check_nick({nick: nick}, function(err, request){
    var $controll_group = $elem.parents('.control-group:first');
    var message;

    if (err) {
      if (err.statusCode === 409) {
        $controll_group.addClass('error');

        message = err.message['nick'];
        $elem.parent().find('.help-block').text(message);
        return;
      }
      message = nodeca.runtime.t('common.error.server_internal');
      nodeca.client.common.notice('error', message);
      return;
    }

    if ($controll_group.hasClass('error')) {
      $controll_group.removeClass('error');

      message = nodeca.runtime.t('users.auth.reg_form.nick_help');
      $elem.parent().find('.help-block').text(message);
    }
  });
  return false;
};
