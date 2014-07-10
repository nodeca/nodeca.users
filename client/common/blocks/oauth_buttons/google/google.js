
'use strict';

var pageParams;


N.wire.on('navigate.done:users.auth.login.show', function setup_page(data) {
  pageParams = data.params;
});


// Sets redirect action and redirect to provider
//
N.wire.on('common.blocks.oauth_bottoms.google', function set_action(event) {
  var $element = $(event.target);
  var url = $element.data('url');
  var action = N.runtime.page_data.action;
  var path = 'users.auth.oauth.remember_action';

  var params = { 'action' : action };
  if (pageParams && pageParams.redirect_id) {
    params.redirect_id = pageParams.redirect_id;
  }

  N.io.rpc(path, params).done(function save_action() {

    // Redirect to oauth provider
    window.location = url;
  });

});
