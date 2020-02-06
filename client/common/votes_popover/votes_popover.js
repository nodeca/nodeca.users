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

  // If popover already shown for this element - hide it instead. Bootstrap popover
  // plugin adds `bs.popover` attribute on popover show
  if (data.$this.data('bs.popover')) {
    data.$this.popover('hide');
    return;
  }

  return N.io.rpc('common.votes_popover', { for: data.$this.data('votes-popover-for') }).then(res => {
    if (res.votes.up.length === 0 && res.votes.down.length === 0) {
      N.wire.emit('notify.info', t('no_votes'));
      return;
    }

    // Create popover
    data.$this.popover({
      template: N.runtime.render('common.votes_popover.template'),
      html: true,
      placement: data.$this.data('votes-popover-placement') || 'left',
      content: N.runtime.render('common.votes_popover', res),
      trigger: 'focus'
    }).on('hidden.bs.popover', function () {
      // Destroy popover after close
      data.$this.popover('dispose');
    });

    // Show popover
    data.$this.popover('show');
  });
});
