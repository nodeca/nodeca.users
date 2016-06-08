// Member page
//
'use strict';


const _           = require('lodash');
const bag         = require('bagjs')({ prefix: 'nodeca' });
const identicon   = require('nodeca.users/lib/identicon');
const avatarWidth = '$$ JSON.stringify(N.config.users.avatars.resize.orig.width) $$';


// Store/restore blocks collapse state
//
N.wire.on('navigate.done:' + module.apiPath, function store_blocks_state(data) {
  let key = [
    'blocks_collapsed',
    N.runtime.user_hid,
    // Different blocks state for owner's page and for another user's page
    data.params.user_hid === N.runtime.user_hid
  ].join('_');

  let collapsedBlocks;

  // Handle show/hide events
  $('.member-block__inner')
    .on('shown.bs.collapse', event => {
      collapsedBlocks = _.without(collapsedBlocks, $(event.target).attr('id'));

      bag.set(key, collapsedBlocks);
    })
    .on('hidden.bs.collapse', function (event) {
      collapsedBlocks.push($(event.target).attr('id'));

      bag.set(key, collapsedBlocks);
    });

  // Restore previous state
  return bag.get(key)
    .then(data => {
      collapsedBlocks = data || [];

      collapsedBlocks.forEach(function (blockID) {
        $('#' + blockID)
          .removeClass('in')
          .parent()
          .find('.member-block__header-collapser')
          .addClass('collapsed');
      });
    })
    .catch(() => {}); // Suppress storage errors
});


N.wire.once('navigate.done:' + module.apiPath, function page_once() {

  // Click to avatar
  //
  N.wire.on(module.apiPath + ':change_avatar', function change_avatar() {
    let data = {};

    return N.wire.emit('users.avatar.change', data).then(() => {
      $('.member-avatar__image').attr('src', N.router.linkTo('core.gridfs', { bucket: data.avatar_id }));
      $('.member-layout').addClass('member-layout__m-avatar-exists');

      // Update avatar in navbar
      N.live.emit('local.users.avatar.change', data.avatar_id, true);
    });
  });


  // Show delete avatar confirm
  //
  N.wire.before(module.apiPath + ':delete_avatar', function confirm_delete_avatar() {
    return N.wire.emit('common.blocks.confirm', t('delete_avatar_confirm'));
  });


  // Click to delete avatar button
  //
  N.wire.on(module.apiPath + ':delete_avatar', function delete_avatar() {
    return N.io.rpc('users.avatar.delete').then(() => {
      let $img = $('.member-avatar__image');

      $img.attr('src', identicon(N.runtime.user_id, avatarWidth));
      $('.member-layout').removeClass('member-layout__m-avatar-exists');

      // Update avatar in navbar
      return N.live.emit('local.users.avatar.change', null, true);
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
