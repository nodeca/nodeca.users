// About block
//
'use strict';


// Init about block
//
N.wire.once('navigate.done:users.member', function init_about() {

  // Init popovers
  //
  $('.member-block__contacts-inline [data-toggle="popover"]').popover();


  // Show more
  //
  N.wire.on(module.apiPath + ':show_more', function about_show_more() {
    $('#member-about-info').addClass('member-about-info__m-show-extra');
  });
});
