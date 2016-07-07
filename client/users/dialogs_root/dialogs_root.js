'use strict';


const _ = require('lodash');


// Offset between navbar and the first dialog
const TOP_OFFSET = 32;

let navbar_height = $('.navbar').height();
let $window = $(window);
// State
//
// - first_offset:       offset of the first dialog in the DOM
// - current_offset:     offset of the current dialog (first in the viewport)
// - dialog_count:       total count of dialogs
// - reached_start:      true iff no more dialog exist above first loaded one
// - reached_end:        true iff no more dialog exist below last loaded one
// - last_dialog_id:     id of the last dialog
// - first_message_id:   id of the last message in the first loaded dialog
// - last_message_id:    id of the last message in the last loaded dialog
// - prev_loading_start: time when current xhr request for the previous page is started
// - next_loading_start: time when current xhr request for the next page is started
//
let dlgListState = {};


/////////////////////////////////////////////////////////////////////
// init on page load

N.wire.on('navigate.done:' + module.apiPath, function page_setup(data) {
  let pagination = N.runtime.page_data.pagination;

  dlgListState.first_offset = pagination.chunk_offset;
  dlgListState.current_offset = -1;
  dlgListState.dialog_count = pagination.total;
  dlgListState.last_dialog_id = N.runtime.page_data.last_dialog_id;
  dlgListState.first_message_id = N.runtime.page_data.first_message_id;
  dlgListState.last_message_id = N.runtime.page_data.last_message_id;
  dlgListState.reached_start = pagination.chunk_offset === 0 || !dlgListState.first_message_id;
  dlgListState.reached_end = (dlgListState.last_dialog_id === $('.dialog-list-item:last-child').data('dialog-id'))
                             || !dlgListState.last_message_id;
  dlgListState.prev_loading_start = 0;
  dlgListState.next_loading_start = 0;

  // disable automatic scroll to an anchor in the navigator
  data.no_scroll = true;

  if (data.state && typeof data.state.dialog_id !== 'undefined' && typeof data.state.offset !== 'undefined') {
    let el = $(`#dialog${data.state.dialog_id}`);

    if (el.length) {
      $window.scrollTop(el.offset().top - $('.navbar').height() - TOP_OFFSET + data.state.offset);
      return;
    }

  } else if (data.params.dialog_id) {
    let el = $(`#dialog${data.params.dialog_id}`);

    if (el.length) {
      $window.scrollTop(el.offset().top - $('.navbar').height() - TOP_OFFSET);
      el.addClass('dialog-list-item__m-highlight');
      return;
    }
  }

  // If we're on the first page, scroll to the top;
  // otherwise, scroll to the first dialog on that page
  //
  if (pagination.chunk_offset > 1 && $('.dialog-list').length) {
    $window.scrollTop($('.dialog-list').offset().top - navbar_height);

  } else {
    $window.scrollTop(0);
  }
});


//////////////////////////////////////////////////////////////////////////
// Replace primary navbar with alt navbar specific to this page

N.wire.on('navigate.done:' + module.apiPath, function navbar_setup() {
  $('.navbar-alt')
    .empty()
    .append(N.runtime.render(module.apiPath + '.navbar_alt', {
      page_progress: {
        current:        dlgListState.current_offset,
        max:            dlgListState.dialog_count,
        per_page:       N.runtime.page_data.pagination.per_page,
        last_dialog_id: dlgListState.last_dialog_id
      }
    }));
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
  if ($('.dialog-list').length === 0) return;

  locationScrollHandler = _.debounce(function update_location_on_scroll() {
    let dialogs         = document.getElementsByClassName('dialog-list-item');
    let dialogThreshold = $window.scrollTop() + navbar_height + TOP_OFFSET;
    let offset;
    let currentIdx;

    // Get offset of the first topic in the viewport
    //
    currentIdx = _.sortedIndexBy(dialogs, null, dlg => {
      if (!dlg) { return dialogThreshold; }
      return dlg.offsetTop;
    });

    if (currentIdx >= dialogs.length) {
      currentIdx = dialogs.length - 1;
    }

    let href = null;
    let state = null;

    offset = currentIdx + dlgListState.first_offset;

    if (currentIdx >= 0 && dialogs.length) {
      state = {
        dialog_id: $(dialogs[currentIdx]).data('dialog-id'),
        offset: dialogThreshold - dialogs[currentIdx].offsetTop
      };
    }

    // save current offset, and only update url if offset is different,
    // it protects url like /messages/4ecabbd0821e2864cda37762 from being overwritten instantly
    if (dlgListState.current_offset !== offset) {
      /* eslint-disable no-undefined */
      href = N.router.linkTo('users.dialogs_root', {
        dialog_id: state ? state.dialog_id : undefined
      });

      dlgListState.current_offset = offset;
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
  if ($('.dialog-list').length === 0) return;

  progressScrollHandler = _.debounce(function update_progress_on_scroll() {
    let viewportStart = $window.scrollTop() + navbar_height;

    // If we scroll below top border of the first topic,
    // show the secondary navbar
    //
    if ($('.dialog-list').offset().top < viewportStart) {
      $('.navbar').addClass('navbar__m-secondary');
    } else {
      $('.navbar').removeClass('navbar__m-secondary');
    }

    // Update progress bar
    //
    let dialogs         = document.getElementsByClassName('dialog-list-item');
    let dialogThreshold = $window.scrollTop() + navbar_height + TOP_OFFSET;
    let offset;
    let currentIdx;

    // Get offset of the first topic in the viewport
    //
    currentIdx = _.sortedIndexBy(dialogs, null, dlg => {
      if (!dlg) { return dialogThreshold; }
      return dlg.offsetTop;
    });

    currentIdx--;

    offset = currentIdx + dlgListState.first_offset;

    N.wire.emit(module.apiPath + '.blocks.page_progress:update', {
      current:  offset + 1, // `+1` because offset is zero based
      max:      dlgListState.dialog_count
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

  // Delete dialog
  //
  N.wire.on(module.apiPath + ':delete_dialog', function delete_dialog(data) {
    let dialog_id = data.$this.data('dialog-id');
    let $dialog = $(`#dialog${dialog_id}`);

    return Promise.resolve()
      .then(() => N.wire.emit('common.blocks.confirm', t('delete_confirmation')))
      .then(() => N.io.rpc('users.dialog.destroy', { dialog_id }))
      .then(() => {
        $dialog.fadeOut(() => $dialog.remove());
      });
  });


  // Show editor for new dialog
  //
  N.wire.on(module.apiPath + ':create_message', function create_message() {
    return N.wire.emit('users.dialog.create:begin');
  });


  ///////////////////////////////////////////////////////////////////////////
  // Whenever we are close to beginning/end of dialog list, check if we can
  // load more pages from the server
  //

  // an amount of topics we try to load when user scrolls to the end of the page
  const LOAD_DLGS_COUNT = N.runtime.page_data.pagination.per_page;

  // A delay after failed xhr request (delay between successful requests
  // is set with affix `throttle` argument)
  //
  // For example, suppose user continuously scrolls. If server is up, each
  // subsequent request will be sent each 100 ms. If server goes down, the
  // interval between request initiations goes up to 2000 ms.
  //
  const LOAD_AFTER_ERROR = 2000;

  N.wire.on(module.apiPath + ':load_prev', function load_prev_page() {
    if (dlgListState.reached_start) return;

    let now = Date.now();

    // `prev_loading_start` is the last request start time, which is reset to 0 on success
    //
    // Thus, successful requests can restart immediately, but failed ones
    // will have to wait `LOAD_AFTER_ERROR` ms.
    //
    if (Math.abs(dlgListState.prev_loading_start - now) < LOAD_AFTER_ERROR) return;

    dlgListState.prev_loading_start = now;

    N.io.rpc('users.dialogs_root.list.by_range', {
      last_message_id: dlgListState.first_message_id,
      before: LOAD_DLGS_COUNT,
      after: 0
    }).then(function (res) {
      if (!res.dialogs) return;

      if (res.dialogs.length !== LOAD_DLGS_COUNT) {
        dlgListState.reached_start = true;
      }

      if (res.dialogs.length === 0) return;

      // remove duplicate topics
      res.dialogs.forEach(dlg => $(`#dialog${dlg._id}`).remove());

      let $list = $('.dialog-list');
      let old_height = $list.height();
      // render & inject topics list
      let $result = $(N.runtime.render('users.blocks.dialog_list', res));

      $list.prepend($result);

      // update scroll so it would point at the same spot as before
      $window.scrollTop($window.scrollTop() + $list.height() - old_height);

      dlgListState.first_message_id = res.dialogs[0].cache.last_message;
      dlgListState.first_offset = res.pagination.chunk_offset;
      dlgListState.topic_count = res.pagination.total;

      dlgListState.prev_loading_start = 0;

      return N.wire.emit(module.apiPath + '.blocks.page_progress:update', {
        max: dlgListState.topic_count
      });
    }).catch(err => N.wire.emit('error', err));
  });


  N.wire.on(module.apiPath + ':load_next', function load_next_page() {
    if (dlgListState.reached_end) return;

    let now = Date.now();

    // `next_loading_start` is the last request start time, which is reset to 0 on success
    //
    // Thus, successful requests can restart immediately, but failed ones
    // will have to wait `LOAD_AFTER_ERROR` ms.
    //
    if (Math.abs(dlgListState.next_loading_start - now) < LOAD_AFTER_ERROR) return;

    dlgListState.next_loading_start = now;

    N.io.rpc('users.dialogs_root.list.by_range', {
      last_message_id: dlgListState.last_message_id,
      before: 0,
      after: LOAD_DLGS_COUNT
    }).then(function (res) {
      if (!res.dialogs) return;

      if (res.dialogs.length !== LOAD_DLGS_COUNT) {
        dlgListState.reached_end = true;
      }

      if (res.dialogs.length === 0) return;

      let $list = $('.dialog-list');
      let old_height = $list.height();
      // render & inject topics list
      let $result = $(N.runtime.render('users.blocks.dialog_list', res));

      // remove duplicate topics
      let deleted_count = res.dialogs.filter(dlg => {
        let el = $(`#dialog${dlg._id}`);

        if (el.length) {
          el.remove();
          return true;
        }
      }).length;

      // update scroll so it would point at the same spot as before
      if (deleted_count > 0) {
        $window.scrollTop($window.scrollTop() + $list.height() - old_height);
      }

      dlgListState.last_message_id = res.dialogs[res.dialogs.length - 1].cache.last_message;
      dlgListState.first_offset = res.pagination.chunk_offset - $('.dialog-list-item').length;
      dlgListState.topic_count = res.pagination.total;


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

      dlgListState.next_loading_start = 0;

      return N.wire.emit(module.apiPath + '.blocks.page_progress:update', {
        max: dlgListState.topic_count
      });
    }).catch(err => N.wire.emit('error', err));
  });
});
