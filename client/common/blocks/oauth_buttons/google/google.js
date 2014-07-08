
'use strict';

// Sets redirect action and redirect to provider
//
N.wire.on('common.blocks.oauth_bottoms.google', function set_action(event) {
  var $element = $(event.target);
  var url = $element.data('url');
  var action = N.runtime.page_data.action;
  var path = 'users.auth.oauth.remember_action';

  N.io.rpc(path, { 'action' : action }).done(function save_action() {

    // Redirect to oauth provider
    window.location = url;
  });

});
