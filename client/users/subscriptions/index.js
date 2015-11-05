'use strict';


var types = '$$ JSON.stringify(N.models.users.Subscription.types) $$';


N.wire.once('navigate.done:' + module.apiPath, function page_once() {

  /////////////////////////////////////////////////////////////////////////////
  // Delete subscription
  //
  N.wire.before('users.subscriptions:delete', function delete_subscription_confirm(data, callback) {
    N.wire.emit('common.blocks.confirm', t('delete_confirmation'), callback);
  });

  N.wire.on('users.subscriptions:delete', function delete_subscription(data, callback) {
    var subscription = data.$this.data('subscription');

    N.io.rpc('users.subscriptions.destroy', { subscription_id: subscription._id }).done(function () {
      var $item = data.$this.closest('.user-subscriptions-item');

      $item
        .fadeTo('fast', 0)
        .slideUp('fast', function () {
          $item.remove();
        });

      callback();
    });
  });


  /////////////////////////////////////////////////////////////////////////////
  // Update subscription
  //
  N.wire.on('users.subscriptions:update', function update_subscription(data, callback) {
    var subscription = data.$this.data('subscription');
    var block_name = data.$this.data('block-name');

    var params = { subscription: subscription.type };

    N.wire.emit('users.subscriptions.blocks.' + block_name + '.update_dlg', params, function () {
      N.io.rpc('users.subscriptions.update', {
        subscription_id: subscription._id,
        type: params.subscription
      }).done(function () {
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
            data.$this.addClass('icon-track-normal');
            break;
          case types.MUTED:
            data.$this.addClass('icon-track-muted');
            break;
        }

        callback();
      });
    });
  });
});
