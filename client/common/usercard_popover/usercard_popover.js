// Show usercard by click profile link.
//
'use strict';


N.wire.once('navigate.done', function init_usercard_click() {
  var $body = $('body');
  var $container = $('.layout__container');
  var $fake_popover = $('<div id="ucard-popover"></div>').appendTo($body);
  var POPOVER_WIDTH = $fake_popover.outerWidth(true);
  var popover_shown = false;

  $fake_popover.remove();

  // Add click handler to `._ucard-popover`.
  //
  $body.on('click', '._ucard-popover', function (event) {
    var $link = $(this);

    // Skip for devices with small screens (navigate profile page).
    if (POPOVER_WIDTH * 1.5 > $container.width()) {
      return;
    }

    // Prevent default navigator behaviour.
    event.preventDefault();

    N.io.rpc(module.apiPath, { id: $link.data('user-id') })
      .done(function (res) {
        var pos_left = $link.offset().left + $link.innerWidth();
        var $card = $(N.runtime.render(module.apiPath, res.user));

        if (pos_left + POPOVER_WIDTH > $container.width()) {

          // If popover with offset get out container edge - show it under
          // link near right container edge.
          $card.css({
            top: $link.offset().top + $link.outerHeight(),
            right: ($(window).width() - $container.width()) / 2
          });

          $card.addClass('ucard-popover__m-bottom');
        } else {

          // Show at one line with link.
          $card.css({
            top: $link.offset().top,
            left: pos_left
          });
        }

        $card.appendTo($body).fadeIn('fast');

        popover_shown = true;
      });
  });


  // Close popover by click outside
  //
  $body.on('click', function (e) {

    // If shown
    if (popover_shown) {

      // If click inside popover
      if (!$(e.target).closest('#ucard-popover').length) {
        $('#ucard-popover').remove();
        popover_shown = false;
      }
    }
  });


  // Close popover on page leave
  //
  N.wire.on('navigate.exit', function page_leave() {
    if (popover_shown) {
      $('#ucard-popover').remove();
      popover_shown = false;
    }
  });
});
