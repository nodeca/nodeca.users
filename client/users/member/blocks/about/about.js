// About block
//
'use strict';


// Init about block
//
N.wire.once('navigate.done:users.member', function init_about() {

  // Expand hidden fields
  //
  N.wire.on(module.apiPath + ':expand', function about_expand() {
    $('#member-about-info').addClass('member-about__m-expanded');
  });
});
