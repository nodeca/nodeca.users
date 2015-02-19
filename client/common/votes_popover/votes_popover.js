// Votes popover dialog
//
//   a(href='#'
//     data-on-click='common.votes_popover'
//     data-votes-popover-for='54e47218aabc79f3700aae06'
//     data-votes-popover-placement='left'
//   )
//

'use strict';


N.wire.on('common.votes_popover', function show_votes_popover(data) {
  N.io.rpc('common.votes_popover', { for: data.$this.data('votes-popover-for') }).done(function (res) {
    if (res.votes.up.length === 0 && res.votes.down.length === 0) {
      N.wire.emit('notify', { type: 'info', message: t('no_votes') });
      return;
    }

    // Create popover
    data.$this.popover({
      content: N.runtime.render('common.votes_popover', res),
      html: true,
      placement: data.$this.data('placement') || 'left',
      trigger: 'focus'
    }).on('hidden.bs.popover', function () {
      // Destroy popover after close
      data.$this.popover('destroy');
    });

    // Remove popover title
    data.$this.attr('data-original-title', '');

    // Show popover
    data.$this.popover('show');
  });
});
