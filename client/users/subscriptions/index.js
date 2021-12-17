'use strict';


const types = '$$ JSON.stringify(N.models.users.Subscription.types) $$';


N.wire.once('navigate.done:' + module.apiPath, function page_once() {

  // Update count badge and modifiers
  //
  function update_tabs() {
    $('.user-subscriptions-tab-pane').each(() => {
      let $tab_pane = $(this);
      let count = $tab_pane.find('.user-subscriptions-list > li').length;

      $('.user-subscriptions-tab__badge-' + $tab_pane.data('block-name')).attr('data-count', count);
      $tab_pane.attr('data-count', count);
    });
  }


  /////////////////////////////////////////////////////////////////////////////
  // Delete subscription
  //
  N.wire.before('users.subscriptions:delete', function delete_subscription_confirm() {
    return N.wire.emit('common.blocks.confirm', t('delete_confirmation'));
  });

  N.wire.on('users.subscriptions:delete', function delete_subscription(data) {
    let subscription = data.$this.data('subscription');

    return N.io.rpc('users.subscriptions.destroy', { subscription_id: subscription._id }).then(function () {
      let $item = data.$this.closest('.user-subscriptions-item');

      $item
        .fadeTo('fast', 0)
        .slideUp('fast', function () {
          $item.remove();
          update_tabs();
        });
    });
  });


  /////////////////////////////////////////////////////////////////////////////
  // Update subscription
  //
  N.wire.on('users.subscriptions:update', function update_subscription(data) {
    let subscription = data.$this.data('subscription');
    let block_name = data.$this.data('block-name');
    let params = { subscription: subscription.type };

    return Promise.resolve()
      .then(() => N.wire.emit('users.subscriptions.blocks.' + block_name + '.update_dlg', params))
      .then(() => N.io.rpc('users.subscriptions.update', {
        subscription_id: subscription._id,
        type: params.subscription
      }))
      .then(() => {
        data.$this.removeClass('icon-track-watching icon-track-tracking icon-track-normal icon-track-muted');

        subscription.type = params.subscription;
        data.$this.data('subscription', subscription);

        switch (params.subscription) {
          case types.WATCHING:
            data.$this.addClass('icon-track-watching');
            break;
          case types.TRACKING:
            data.$this.addClass('icon-track-tracking');
            break;
          case types.NORMAL:
            var $item = data.$this.closest('.user-subscriptions-item');

            $item
              .fadeTo('fast', 0)
              .slideUp('fast', function () {
                $item.remove();
                update_tabs();
              });

            data.$this.addClass('icon-track-normal');
            break;
          case types.MUTED:
            data.$this.addClass('icon-track-muted');
            break;
        }
      });
  });


  N.wire.on('users.subscriptions:mark_all_read', function mark_all_read(data) {
    let marker_types = Array.from(new Set(data.$this.data('marker-types')));

    return N.io.rpc('users.tracker.mark_read', { marker_types, ts: N.runtime.page_data.mark_cut_ts })
               .then(() => N.wire.emit('navigate.reload'));
  });


  N.wire.on('users.subscriptions:mark_tab_read', function mark_tab_read() {
    let marker_types = Array.from(new Set($('.user-subscriptions-tab-pane.active').data('marker-types')));

    return N.io.rpc('users.tracker.mark_read', { marker_types, ts: N.runtime.page_data.mark_cut_ts })
               .then(() => N.wire.emit('navigate.reload'));
  });
});
