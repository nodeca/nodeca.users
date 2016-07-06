// Show usercard by click profile link.
//
'use strict';


const _ = require('lodash');


N.wire.once('navigate.done', function init_usercard_click() {
  let $body = $('body');
  let $container = $('.layout__container');
  let $fake_popover = $('<div id="ucard-popover"></div>').appendTo($body);
  let POPOVER_WIDTH = $fake_popover.outerWidth(true);
  let POPOVER_HEIGHT = $fake_popover.outerHeight(true);
  let popover_shown = false;

  $fake_popover.remove();

  // Add click handler to `._ucard-popover`.
  //
  $body.on('click', '._ucard-popover', function (event) {
    let $link = $(this);

    // Skip for devices with small screens (navigate profile page).
    if (POPOVER_WIDTH * 1.5 > $container.width() ||
        POPOVER_HEIGHT * 2 > $(window).height()) {
      return;
    }

    // Try parse href to get `user_hid` from member page link.
    let user_hid = _.chain(N.router.matchAll($link.attr('href')))
      .find(function (match) { return _.get(match, 'meta.methods.get') === 'users.member'; })
      .get('params.user_hid')
      .value();

    if (!user_hid) return;

    // Prevent default navigator behaviour.
    event.preventDefault();

    N.io.rpc(module.apiPath, { user_hid })
      .then(function (res) {
        let pos_left = $link.offset().left + $link.innerWidth();
        let $card = $(N.runtime.render(module.apiPath, res));

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
      })
      .catch(err => {
        if (err.code !== N.io.NOT_FOUND) {
          throw err;
        }

        N.wire.emit('notify', { type: 'error', message: t('error') });
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


  // Create new dialog with user
  //
  N.wire.on(module.apiPath + ':message', function create_dialog(data) {
    let params = {
      nick: data.$this.data('to-nick'),
      hid: data.$this.data('to-hid')
    };

    return N.wire.emit('users.dialog.create:begin', params)
      .then(() => {
        if (popover_shown) {
          $('#ucard-popover').remove();
          popover_shown = false;
        }
      });
  });
});
