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


/*global nodeca*/

var DELAY = 500;

var timeout;

/**
 *  client.common.auth.register.check_nick($elem, event)
 *
 *  send nick value on server
 *  and show error if nick exists
 **/
module.exports = function ($elem) {
  // make sure previous timeout was cleared
  clearTimeout(timeout);

  // delay request
  timeout = setTimeout(function () {
    var nick = $elem.val();
    nodeca.server.users.auth.register.check_nick({ nick: nick }, function (err) {
      var $control_group = $elem.parents('.control-group:first');

      if (err) {
        // Problems with nick
        if (err.code === nodeca.io.BAD_REQUEST) {
          $control_group.addClass('error');

          $control_group.find('.help-block').text(
            err.message['nick']
            );
          return;
        }

        // something fatal
        nodeca.client.common.notify('error', err.message);
        return;
      }

      // no errors -> restore defaults

      $control_group.removeClass('error');
      $control_group.find('.help-block').text(
        nodeca.runtime.t('users.auth.reg_form.nick_help')
      );

    });
  }, DELAY);
  return false;
};
