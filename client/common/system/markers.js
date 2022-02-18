'use strict';

class MarkerManager {
  constructor(user_id = 0) {
    if (!user_id) return;

    this.bkv = require('bkv').create({ prefix: `markers_user${user_id}` });
  }

  set(pos, max, content_id, category_id, type) {
    if (!this.bkv) return Promise.resolve();

    return this.bkv.set(
      content_id,
      { pos, max, content_id, category_id, type },
      7 * 24 * 3600 // Expire after 7 days
    );
  }

  flush(/*delay = 0*/) {
    if (!this.bkv) return Promise.resolve();
  }
}


// Do just before "render_first_page()", to be able to replace data
// after markers flush.
N.wire.once('navigate.done', { priority: -991 }, () => {
  N.markers = new MarkerManager(N.runtime.user_hid);

  //
  // Listen events to flush markers
  //

  N.wire.on('navigate.exit', function flush_markers_on_exit() {
    return N.markers.flush();
  });

  document.addEventListener('visibilitychange', () => {
    // If event caused by tab switch => prefer hidden tab to save markers.
    // If event caused by tab close => new tab will continue after 1 sec
    if (document.hidden) N.markers.flush();
    else N.markers.flush(1000);
  });

  //
  // Now try to flush markers and reload render_first_page() data
  // if markers were nor empty
  //

  return N.markers.flush().then(flushed_count => {
    if (!flushed_count) return;

    if (!$('#loading-stub-data').length) return;

    let page_raw = {};

    // markers updated => reload page data & re-inject
    return N.wire.emit('navigate.get_page_raw', page_raw).then(() => {
      $('#loading-stub-data').text(JSON.stringify(page_raw.data));
    });
  });
});
