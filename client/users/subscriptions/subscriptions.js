'use strict';


const types = '$$ JSON.stringify(N.models.users.Subscription.types) $$';


N.wire.once('navigate.done:' + module.apiPath, function page_once() {


  function update_tab_count() {
    let count = $('.user-subscriptions-item').length;

    $('.content-tabs-link.active > .content-tabs-counter').text(count);
  }


  /////////////////////////////////////////////////////////////////////////////
  // Delete subscription
  //
  N.wire.before(module.apiPath + ':delete', function delete_subscription_confirm() {
    return N.wire.emit('common.blocks.confirm', t('delete_confirmation'));
  });

  N.wire.on(module.apiPath + ':delete', function delete_subscription(data) {
    let subscription = data.$this.data('subscription');

    return N.io.rpc(module.apiPath + '.destroy', { subscription_id: subscription._id }).then(function () {
      // animate item removal
      let $item = data.$this.closest('.user-subscriptions-item');

      $item
        .fadeTo('fast', 0)
        .slideUp('fast', function () {
          $item.remove();
          update_tab_count();
        });
    });
  });


  /////////////////////////////////////////////////////////////////////////////
  // Update subscription
  //
  N.wire.on(module.apiPath + ':update', function update_subscription(data) {
    let subscription = data.$this.data('subscription');
    let block_name = data.$this.data('block-name');
    let params = { subscription: subscription.type };

    return Promise.resolve()
      .then(() => N.wire.emit(module.apiPath + '.blocks.' + block_name + '.update_dlg', params))
      .then(() => N.io.rpc(module.apiPath + '.update', {
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
            // animate item removal
            let $item = data.$this.closest('.user-subscriptions-item');

            $item
              .fadeTo('fast', 0)
              .slideUp('fast', function () {
                $item.remove();
                update_tab_count();
              });

            data.$this.addClass('icon-track-normal');
            break;
          case types.MUTED:
            data.$this.addClass('icon-track-muted');
            break;
        }
      });
  });


  N.wire.on(module.apiPath + ':mark_all_read', function mark_all_read() {
    return N.io.rpc('users.tracker.mark_read', { ts: N.runtime.page_data.mark_cut_ts })
               .then(() => N.wire.emit('navigate.reload'));
  });
});
