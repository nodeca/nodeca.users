'use strict';


var getFormData = require('nodeca.core/lib/client/get_form_data');


var CHECK_NICK_DELAY = 500;
var checkNickTimeout;


//
// Send registration data on server.
//
N.wire.on('users.auth.register.exec', function register(event) {
  var $form  = $(event.currentTarget)
    , params = getFormData($form);

  N.io.rpc('users.auth.register.exec', params, function (err) {
    if (err) {
      // Wrong form params - regenerate page with hightlighted errors
      if (N.io.BAD_REQUEST === err.code) {
        // add errors
        params.errors = err.data;
        $('#content').replaceWith(N.runtime.render(module.apiPath, params));
      } else {
        // no need for fatal errors notifications as it's done by io automagically
        N.logger.error(err);
      }
      return;
    }

    window.location = N.runtime.router.linkTo('users.auth.register.success');
  });
});


//
// Send nick value on server and show error if nick exists
//
N.wire.on('users.auth.register.check_nick', function register_check_nick(event) {
  var $elem = $(event.currentTarget);

  // make sure previous timeout was cleared
  clearTimeout(checkNickTimeout);

  // delay request
  checkNickTimeout = setTimeout(function () {
    var nick = $elem.val();

    N.io.rpc('users.auth.register.check_nick', { nick: nick }, function (err) {
      var $control_group = $elem.parents('.control-group:first');

      if (err) {
        if (N.io.BAD_REQUEST === err.code) {
          // Problems with nick
          $control_group.addClass('error');
          $control_group.find('.help-block').text(err.message['nick']);
        } else {
          // something fatal
          N.wire.emit('notify', err.message);
        }
        return;
      }

      // no errors -> restore defaults
      $control_group.removeClass('error');
      $control_group.find('.help-block').text(t('nick_help'));
    });
  }, CHECK_NICK_DELAY);
});
