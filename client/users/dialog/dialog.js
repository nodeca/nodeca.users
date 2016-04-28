'use strict';


const _ = require('lodash');


// Offset between navbar and the first dialog
const TOP_OFFSET = 50;

let navbar_height = $('.navbar').height();
let $window = $(window);
// State
//
// - dialog_id           current dialog id
// - first_offset:       offset of the first message in the DOM
// - current_offset:     offset of the current message (first in the viewport)
// - message_count:      total count of messages
// - reached_start:      true iff no more message exist above first loaded one
// - reached_end:        true iff no more message exist below last loaded one
// - first_message_id:   id of the first message
// - last_message_id:    id of the last message
// - prev_loading_start: time when current xhr request for the previous page is started
// - next_loading_start: time when current xhr request for the next page is started
//
let dlgState = {};


/////////////////////////////////////////////////////////////////////
// init on page load

N.wire.on('navigate.done:' + module.apiPath, function page_setup(data) {
  let pagination = N.runtime.page_data.pagination;

  dlgState.dialog_id = N.runtime.page_data.dialog._id;
  dlgState.first_offset = pagination.chunk_offset;
  dlgState.current_offset = -1;
  dlgState.message_count = pagination.total;
  dlgState.first_message_id = N.runtime.page_data.first_message_id;
  dlgState.last_message_id = N.runtime.page_data.last_message_id;
  dlgState.reached_start = pagination.chunk_offset === 0;
  dlgState.reached_end = (dlgState.last_message_id === $('.user-messages-list-item:last-child').data('message-id'));
  dlgState.prev_loading_start = 0;
  dlgState.next_loading_start = 0;

  // disable automatic scroll to an anchor in the navigator
  data.no_scroll = true;

  // If we have state in history - scroll to saved offset
  if (data.state && typeof data.state.message_id !== 'undefined' && typeof data.state.offset !== 'undefined') {
    let el = $(`#message${data.state.message_id}`);

    if (el.length) {
      $window.scrollTop(el.offset().top - $('.navbar').height() - TOP_OFFSET + data.state.offset);
      return;
    }

  }

  // If navigated to first message - scroll to top
  if (data.params.message_id === dlgState.first_message_id) {
    $window.scrollTop(0);
    return;
  }

  let el = $(`#message${data.params.message_id}`);

  // Scroll to needed message
  if (el.length) {
    $window.scrollTop(el.offset().top - $('.navbar').height() - TOP_OFFSET);
    el.addClass('user-messages-list-item__m-highlight');
    return;
  }
});


//////////////////////////////////////////////////////////////////////////
// Replace primary navbar with alt navbar specific to this page

N.wire.on('navigate.done:' + module.apiPath, function navbar_setup() {
  $('.navbar-alt')
    .empty()
    .append(N.runtime.render(module.apiPath + '.navbar_alt', {
      dialog:        N.runtime.page_data.dialog,

      page_progress: {
        current:          dlgState.current_offset,
        max:              dlgState.message_count,
        per_page:         N.runtime.page_data.pagination.per_page,
        last_message_id:  dlgState.last_message_id,
        first_message_id: dlgState.first_message_id,
        dialog_id:        dlgState.dialog_id
      }
    }));
});


N.wire.on('navigate.exit:' + module.apiPath, function navbar_teardown() {
  $('.navbar-alt').empty();
  $('.navbar').removeClass('navbar__m-secondary');
});




/////////////////////////////////////////////////////////////////////
// Change URL when user scrolls the page
//
// Use a separate debouncer that only fires when user stops scrolling,
// so it's executed a lot less frequently.
//
// The reason is that `history.replaceState` is very slow in FF
// on large pages: https://bugzilla.mozilla.org/show_bug.cgi?id=1250972
//
let locationScrollHandler = null;


N.wire.on('navigate.done:' + module.apiPath, function location_updater_init() {
  if ($('.user-messages-list').length === 0) return;

  locationScrollHandler = _.debounce(function update_location_on_scroll() {
    let messages         = document.getElementsByClassName('user-messages-list-item');
    let messageThreshold = $window.scrollTop() + navbar_height + TOP_OFFSET;
    let offset;
    let currentIdx;

    // Get offset of the first topic in the viewport
    //
    currentIdx = _.sortedIndexBy(messages, null, msg => {
      if (!msg) { return messageThreshold; }
      return msg.offsetTop;
    });

    if (currentIdx >= messages.length) {
      currentIdx = messages.length - 1;
    }

    let href = null;
    let state = null;

    offset = currentIdx + dlgState.first_offset;

    if (currentIdx >= 0 && messages.length) {
      state = {
        message_id: $(messages[currentIdx]).data('message-id'),
        offset: messageThreshold - messages[currentIdx].offsetTop
      };
    }

    // save current offset, and only update url if offset is different,
    // it protects url like /messages/4ecabbd0821e2864cda37762 from being overwritten instantly
    if (dlgState.current_offset !== offset) {
      /* eslint-disable no-undefined */
      href = N.router.linkTo('users.dialog', {
        dialog_id: dlgState.dialog_id,
        message_id: state ? state.message_id : undefined
      });

      dlgState.current_offset = offset;
    }

    N.wire.emit('navigate.replace', { href, state });
  }, 500);

  // avoid executing it on first tick because of initial scrollTop()
  setTimeout(() => {
    $window.on('scroll', locationScrollHandler);
  }, 1);
});


N.wire.on('navigate.exit:' + module.apiPath, function location_updater_teardown() {
  if (!locationScrollHandler) return;
  locationScrollHandler.cancel();
  $window.off('scroll', locationScrollHandler);
  locationScrollHandler = null;
});


/////////////////////////////////////////////////////////////////////
// When user scrolls the page:
//
//  1. update progress bar
//  2. show/hide navbar
//
let progressScrollHandler = null;


N.wire.on('navigate.done:' + module.apiPath, function progress_updater_init() {
  if ($('.user-messages-list').length === 0) return;

  progressScrollHandler = _.debounce(function update_progress_on_scroll() {
    let viewportStart = $window.scrollTop() + navbar_height;

    // If we scroll below top border of the first topic,
    // show the secondary navbar
    //
    if ($('.user-messages-list').offset().top < viewportStart) {
      $('.navbar').addClass('navbar__m-secondary');
    } else {
      $('.navbar').removeClass('navbar__m-secondary');
    }

    // Update progress bar
    //
    let messages         = document.getElementsByClassName('user-messages-list-item');
    let messageThreshold = $window.scrollTop() + navbar_height + TOP_OFFSET;
    let offset;
    let currentIdx;

    // Get offset of the first topic in the viewport
    //
    currentIdx = _.sortedIndexBy(messages, null, msg => {
      if (!msg) { return messageThreshold; }
      return msg.offsetTop;
    });

    currentIdx--;

    offset = currentIdx + dlgState.first_offset;

    N.wire.emit(module.apiPath + '.blocks.page_progress:update', {
      current:  offset + 1, // `+1` because offset is zero based
      max:      dlgState.message_count
    }).catch(err => N.wire.emit('error', err));
  }, 100, { maxWait: 100 });

  // avoid executing it on first tick because of initial scrollTop()
  setTimeout(() => {
    $window.on('scroll', progressScrollHandler);
  });

  // execute it once on page load
  progressScrollHandler();
});


N.wire.on('navigate.exit:' + module.apiPath, function progress_updater_teardown() {
  if (!progressScrollHandler) return;
  progressScrollHandler.cancel();
  $window.off('scroll', progressScrollHandler);
  progressScrollHandler = null;
});


// Init handlers
//
N.wire.once('navigate.done:' + module.apiPath, function page_init() {

  // Show editor for reply
  //
  N.wire.on(module.apiPath + ':reply', function reply(data) {
    return N.wire.emit('users.dialog.reply:begin', {
      dialog_id:           data.$this.data('dialog-id'),
      dialog_title:        data.$this.data('dialog-title'),
      dialog_last_message: data.$this.data('dialog-last-message')
    });
  });


  ///////////////////////////////////////////////////////////////////////////
  // Whenever we are close to beginning/end of dialog list, check if we can
  // load more pages from the server
  //

  // an amount of topics we try to load when user scrolls to the end of the page
  const LOAD_MSGS_COUNT = N.runtime.page_data.pagination.per_page;

  // A delay after failed xhr request (delay between successful requests
  // is set with affix `throttle` argument)
  //
  // For example, suppose user continuously scrolls. If server is up, each
  // subsequent request will be sent each 100 ms. If server goes down, the
  // interval between request initiations goes up to 2000 ms.
  //
  const LOAD_AFTER_ERROR = 2000;

  N.wire.on(module.apiPath + ':load_prev', function load_prev_page() {
    if (dlgState.reached_start) return;

    let now = Date.now();

    // `prev_loading_start` is the last request start time, which is reset to 0 on success
    //
    // Thus, successful requests can restart immediately, but failed ones
    // will have to wait `LOAD_AFTER_ERROR` ms.
    //
    if (Math.abs(dlgState.prev_loading_start - now) < LOAD_AFTER_ERROR) return;

    dlgState.prev_loading_start = now;

    N.io.rpc('users.dialog.list.by_range', {
      dialog_id: dlgState.dialog_id,
      last_message_id: $('.user-messages-list-item:first-child').data('message-id'),
      before: LOAD_MSGS_COUNT,
      after: 0
    }).then(function (res) {
      if (!res.messages) return;

      if (res.messages.length !== LOAD_MSGS_COUNT) {
        dlgState.reached_start = true;
      }

      if (res.messages.length === 0) return;

      // remove duplicate topics
      res.messages.forEach(msg => $(`#message${msg._id}`).remove());

      let $list = $('.user-messages-list');
      let old_height = $list.height();
      // render & inject topics list
      let $result = $(N.runtime.render('users.blocks.message_list', res));

      $list.prepend($result);

      // update scroll so it would point at the same spot as before
      $window.scrollTop($window.scrollTop() + $list.height() - old_height);

      dlgState.first_offset = res.pagination.chunk_offset;
      dlgState.topic_count = res.pagination.total;

      dlgState.prev_loading_start = 0;

      return N.wire.emit(module.apiPath + '.blocks.page_progress:update', {
        max: dlgState.topic_count
      });
    }).catch(err => N.wire.emit('error', err));
  });


  N.wire.on(module.apiPath + ':load_next', function load_next_page() {
    if (dlgState.reached_end) return;

    let now = Date.now();

    // `next_loading_start` is the last request start time, which is reset to 0 on success
    //
    // Thus, successful requests can restart immediately, but failed ones
    // will have to wait `LOAD_AFTER_ERROR` ms.
    //
    if (Math.abs(dlgState.next_loading_start - now) < LOAD_AFTER_ERROR) return;

    dlgState.next_loading_start = now;

    N.io.rpc('users.dialog.list.by_range', {
      dialog_id: dlgState.dialog_id,
      last_message_id: $('.user-messages-list-item:last-child').data('message-id'),
      before: 0,
      after: LOAD_MSGS_COUNT
    }).then(function (res) {
      if (!res.messages) return;

      if (res.messages.length !== LOAD_MSGS_COUNT) {
        dlgState.reached_end = true;
      }

      if (res.messages.length === 0) return;

      let $list = $('.user-messages-list');
      let old_height = $list.height();
      // render & inject topics list
      let $result = $(N.runtime.render('users.blocks.message_list', res));

      // remove duplicate topics
      let deleted_count = res.messages.filter(msg => {
        let el = $(`#message${msg._id}`);

        if (el.length) {
          el.remove();
          return true;
        }
      }).length;

      // update scroll so it would point at the same spot as before
      if (deleted_count > 0) {
        $window.scrollTop($window.scrollTop() + $list.height() - old_height);
      }

      dlgState.first_offset = res.pagination.chunk_offset - $('.user-messages-list-item').length;
      dlgState.topic_count = res.pagination.total;


      $list.append($result);

      // Workaround for FF bug, possibly this one:
      // https://github.com/nodeca/nodeca.core/issues/2
      //
      // When user scrolls down and we insert content to the end
      // of the page, and the page is large enough (~1000 topics
      // or more), next scrollTop() read on 'scroll' event may
      // return invalid (too low) value.
      //
      // Reading scrollTop in the same tick seem to prevent this
      // from happening.
      //
      $window.scrollTop();

      dlgState.next_loading_start = 0;

      return N.wire.emit(module.apiPath + '.blocks.page_progress:update', {
        max: dlgState.message_count
      });
    }).catch(err => N.wire.emit('error', err));
  });
});
