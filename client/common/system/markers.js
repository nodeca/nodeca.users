'use strict';


const bkv = require('bkv');


class MarkerManager {
  constructor(user_hid = 0) {
    if (!user_hid) return;

    this.bkv = bkv.create({ prefix: `markers_user${user_hid}` });
    this.flush_promise = null;
    this.flush_timer = null;
    this.flush_timer_ts = 0;
  }

  set(content_id, category_id, type, position, max) {
    if (!this.bkv) return Promise.resolve();

    Promise.resolve()
      .then(() => this.bkv.get(content_id))
      .then(data => {
        if (data && max < data.max) max = data.max;
      })
      .then(() => this.bkv.set(
        content_id,
        { content_id, category_id, type, position, max },
        7 * 24 * 3600 // Expire after 7 days
      ))
      .then(() => this.flushAfter(3000))
      .catch(err => N.wire.emit('error', err));
  }

  flush() {
    if (!this.bkv) return Promise.resolve();

    if (this.flush_timer) {
      clearTimeout(this.flush_timer);
      this.flush_timer = null;
      this.flush_timer_ts = 0;
    }

    if (this.flush_promise) {
      this.flush_promise = this.flush_promise.then(() => this.flush());
      return this.flush_promise;
    }

    let data = [];

    this.flush_promise = Promise.resolve()
      .then(() => this.bkv.getAll())
      .then(new_data => {
        data = new_data;
        if (!data.length) return;
        return N.io.rpc('users.marker_set_pos', data.map(d => d.value));
      })
      .then(() => {
        if (!data.length) return;
        return this.bkv.getAll();
      })
      .then(new_data => {
        if (!data.length) return;
        let keys_to_remove = [];

        for (let { key, value } of data) {
          let new_value = new_data.find(d => d.key === key)?.value;

          if (JSON.stringify(value) === JSON.stringify(new_value)) {
            keys_to_remove.push(key);
          }
        }

        return this.bkv.remove(keys_to_remove);
      })
      .catch(err => N.wire.emit('error', err))
      .then(() => {
        this.flush_promise = null;
        return data.length;
      });

    return this.flush_promise;
  }

  flushAfter(delay) {
    if (!this.bkv) return Promise.resolve();
    if (this.flush_timer_ts > 0 && this.flush_timer_ts < Date.now() + delay) return Promise.resolve();

    clearTimeout(this.flush_timer);
    this.flush_timer_ts = Date.now() + delay;
    this.flush_timer = setTimeout(() => {
      this.flush_timer = null;
      this.flush_timer_ts = 0;
      this.flush();
    }, delay);
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
    else N.markers.flushAfter(1000);
  });

  //
  // Now try to flush markers and reload render_first_page() data
  // if markers were not empty
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
