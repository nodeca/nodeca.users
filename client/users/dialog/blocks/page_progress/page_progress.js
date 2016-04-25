// Update progress bar
//

'use strict';


N.wire.on(module.apiPath + ':update', function update_progress(data) {
  let current = data.current;
  let total = data.max;

  if (typeof current === 'undefined' || current === null) {
    current = $('.page-progress').data('current');
  }

  if (typeof total === 'undefined' || total === null) {
    total = $('.page-progress').data('total');
  }

  // ensure that current is in [1..total] range
  current = Math.max(1, Math.min(current, total));

  $('.page-progress__label').text(
    N.runtime.t(module.apiPath + '.label', { current, total })
  );

  $('.page-progress__bar-fill').css({
    width: (current / total * 100).toFixed(2) + '%'
  });

  $('.page-progress').data('current', current).data('total', total);
});
