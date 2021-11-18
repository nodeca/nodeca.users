// If user disabled heavy content in settings
//  - replace images with placeholder (which can still be loaded by clicking on it)
//  - replace embedza blocks with inline links
//

'use strict';


// Replace thumbnails (sm attachments)
//
function replace_thumbs(selector) {
  selector.find('.thumb > img').each(function (n, img) {
    let container = img.parentNode, $container = $(container);

    // replaced by another step
    if (typeof $container.data('heavy-content-placeholder') !== 'undefined') return;

    $container.replaceWith(N.runtime.render(module.apiPath + '.thumb', {
      apiPath: module.apiPath,
      orig: $container.data('nd-image-orig'),
      placeholder: container.outerHTML,
      width: $container.find('.thumb__image').attr('width'),
      height: $container.find('.thumb__image').attr('height')
    }));
  });
}


// Replace attachments with placeholders
//
function replace_attachments(selector) {
  selector.find('.attach-img > img').each(function (n, img) {
    let container = img.parentNode, $container = $(container);

    // replaced by another step
    if (typeof $container.data('heavy-content-placeholder') !== 'undefined') return;

    $container.replaceWith(N.runtime.render(module.apiPath + '.attach', {
      apiPath: module.apiPath,
      orig: $container.data('nd-image-orig'),
      placeholder: container.outerHTML,
      image_style: $container.attr('style'),
      spacer_style: $container.find('.attach__spacer').attr('style')
    }));
  });
}


// Replace images with placeholders
//
function replace_images(selector) {
  // images with known size (wrapped in a span.image tag)
  selector.find('.image > img').each(function (n, img) {
    let container = img.parentNode, $container = $(container);

    // replaced by another step
    if (typeof $container.data('heavy-content-placeholder') !== 'undefined') return;

    $container.replaceWith(N.runtime.render(module.apiPath + '.image', {
      apiPath: module.apiPath,
      orig: $container.data('nd-image-orig'),
      placeholder: container.outerHTML,
      image_style: $container.attr('style'),
      spacer_style: $container.find('.image__spacer').attr('style')
    }));
  });

  // images with unknown size (just a single image tag)
  selector.find('img.image').each(function (n, img) {
    let container = img, $container = $(container);

    // replaced by another step
    if (typeof $container.data('heavy-content-placeholder') !== 'undefined') return;

    $container.replaceWith(N.runtime.render(module.apiPath + '.image', {
      apiPath: module.apiPath,
      orig: $container.data('nd-image-orig'),
      placeholder: container.outerHTML
    }));
  });
}


// Replace embedza players with links
//
function replace_videos(selector) {
  selector.find('.ez-player').each(function (n, container) {
    let $container = $(container);

    // replaced by another step
    if (typeof $container.data('heavy-content-placeholder') !== 'undefined') return;

    $container.replaceWith(N.runtime.render(module.apiPath + '.video', {
      orig: $container.data('nd-image-orig')
    }));
  });
}


N.wire.once('navigate.done', function hide_heavy_content_init(data) {
  // when user clicks on image area, replace it with original image
  N.wire.on(module.apiPath + ':expand', function expand_hidden_element(data) {
    data.$this.replaceWith(data.$this.data('nd-placeholder'));
  });


  // sync setting when user changes it from another tab
  N.live.on('local.users.settings.hide_heavy_content.change', function toggle_heavy_content(value) {
    N.runtime.settings.hide_heavy_content = value;
  });


  // replace images with placeholders on initial page load
  if (N.runtime.settings.hide_heavy_content && data.first_load) {
    let content = $('.markup');

    replace_thumbs(content);
    replace_attachments(content);
    replace_images(content);
    replace_videos(content);
  }
});


N.wire.on('navigate.content_update', function hide_heavy_content(data) {
  if (!N.runtime.settings.hide_heavy_content) return;

  let content = data.$.find('.markup');

  replace_thumbs(content);
  replace_attachments(content);
  replace_images(content);
  replace_videos(content);
});
