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

var start_point;

/**
 *  client.common.auth.register.check_nick($elem, event)
 *
 *  send nick value on server
 *  and show error if nick exists
 **/
module.exports = function ($elem, event) {
  // update start point each time
  start_point = new Date();

  // delay request
  setTimeout(function() {

    // time is not come
    // new event(s) update start point
    if (DELAY > new Date() - start_point) {
      return;
    }

    // reset time
    start_point = null;

    var nick = $elem.val();
    nodeca.server.users.auth.register.check_nick({ nick: nick }, function(err){
      var $control_group = $elem.parents('.control-group:first');

      if (err) {
        // Problems with nick
        if (err.statusCode === nodeca.io.BAD_REQUEST) {
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
