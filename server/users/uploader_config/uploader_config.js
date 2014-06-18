// Return uploader settings


'use strict';


module.exports = function (N, apiPath) {

  N.validate(apiPath, {});

  // Fill uploader settings
  //
  N.wire.on(apiPath, function fill_uploader_settings(env) {
    var cfg = N.config.options.users;
    env.res = {
      width: cfg.media_sizes.orig.width,
      height: cfg.media_sizes.orig.height,
      max_size_kb: cfg.media_uploads.max_size_kb,
      resize_types: cfg.media_uploads.client_resize_types,
      allowed_extensions: cfg.media_uploads.allowed_extensions
    };
  });
};
