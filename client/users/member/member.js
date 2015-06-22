// Member page
//

'use strict';

var _           = require('lodash');
var Bag         = require('bag.js');
var identicon   = require('nodeca.users/lib/identicon');
var avatarWidth = '$$ JSON.stringify(N.config.users.avatars.resize.orig.width) $$';


// Store/restore blocks collapse state
//
N.wire.on('navigate.done:' + module.apiPath, function store_blocks_state(data, callback) {
  var key = [
    'blocks_collapsed',
    N.runtime.user_hid,
    // Different blocks state for owner's page and for another user's page
    data.params.user_hid === N.runtime.user_hid
  ].join('_');

  var collapsedBlocks;

  var bag = new Bag({
    prefix: 'nodeca_settings',
    expire: 12 * 30 * 24 // 1 year
  });

  // Handle show/hide events
  $('.member-block__inner')
    .on('shown.bs.collapse', function (event) {
      collapsedBlocks = _.without(collapsedBlocks, $(event.target).attr('id'));

      bag.set(key, collapsedBlocks);
    })
    .on('hidden.bs.collapse', function (event) {
      collapsedBlocks.push($(event.target).attr('id'));

      bag.set(key, collapsedBlocks);
    });

  // Restore previous state
  bag.get(key, function (__, data) {
    collapsedBlocks = data || [];

    collapsedBlocks.forEach(function (blockID) {
      $('#' + blockID)
        .removeClass('in')
        .parent()
        .find('.member-block__header-collapser')
        .addClass('collapsed');
    });

    callback();
  });
});


N.wire.once('navigate.done:' + module.apiPath, function page_once() {

  // Click to avatar
  //
  N.wire.on('users.member:change_avatar', function change_avatar(__, callback) {
    var data = {};

    N.wire.emit('users.avatar.change', data, function () {

      $('.member-avatar__image').attr('src', N.router.linkTo('core.gridfs', { bucket: data.avatar_id }));
      $('.member-layout').addClass('member-layout__m-avatar-exists');

      // Update avatar in navbar
      N.live.emit('local.users.avatar.change', data.avatar_id, true);

      callback();
    });
  });


  // Show delete avatar confirm
  //
  N.wire.before('users.member:delete_avatar', function confirm_delete_avatar(data, callback) {
    N.wire.emit('common.blocks.confirm', t('delete_avatar_confirm'), callback);
  });


  // Click to delete avatar button
  //
  N.wire.on('users.member:delete_avatar', function delete_avatar(__, callback) {
    N.io.rpc('users.avatar.delete').done(function (/* result */) {

      var $img = $('.member-avatar__image');
      $img.attr('src', identicon(N.runtime.user_id, avatarWidth));

      $('.member-layout').removeClass('member-layout__m-avatar-exists');

      // Update avatar in navbar
      N.live.emit('local.users.avatar.change', null, true);

      callback();
    });
  });


  // Page exit
  //
  N.wire.on('navigate.exit:' + module.apiPath, function page_exit() {
    $('.member-block__inner')
      .off('shown.bs.collapse')
      .off('hidden.bs.collapse');
  });
});
