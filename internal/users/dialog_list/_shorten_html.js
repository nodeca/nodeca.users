// Convert html content to a short snippet
//
//  1. remove all top-level block tags except paragraphs (block quotes, video players, etc.)
//  2. merge all paragraphs into one
//  3. replace images with their alt tags
//  4. limit the total text length of the resulting paragraph (not counting tags)
//
'use strict';


const _        = require('lodash');
const $        = require('nodeca.core/lib/parser/cheequery');
const beautify = require('nodeca.core/lib/parser/beautify_url');


const MAX_TEXT_LENGTH = 500;
// replacement for image in post snippets
const attachTpl = _.template('<a class="icon icon-picture attach-collapsed" ' +
                             'href="<%- href %>"></a>');
const imageTpl = _.template('<a class="icon icon-picture image-collapsed" ' +
                            'href="<%- href %>" target="_blank" rel="nofollow"></a>');
// replacement for media players
const blockLinkTpl = _.template('<p><a class="link link-ext" href="<%- href %>" target="_blank" rel="nofollow">' +
                                '<%- content %></a></p>');

function shorten(html) {
  var ast = $('<div>').html(html);
  var length = 0;
  var ellipsis = false;

  // remove all tags except whitelisted
  function remove_tags(node) {
    node.children().each(function () {
      var element = $(this);

      remove_tags(element);

      // whitelist all tags that we want to keep
      if (!element.filter('a, em, strong, s, .emoji').length) {
        element.replaceWith(element.contents());
      }
    });
  }

  // remove all child elements above MAX_TEXT_LENGTH limit
  function limit_length(node) {
    node.contents().each(function () {
      if (length >= MAX_TEXT_LENGTH) {
        if (!ellipsis) {
          ellipsis = true;
          $(this).replaceWith('…');
        } else {
          $(this).remove();
        }

        return;
      }

      if (this.type === 'text') {
        length += this.data.length;

        if (length > MAX_TEXT_LENGTH) {
          this.data = this.data.slice(0, MAX_TEXT_LENGTH - length) + '…';
          ellipsis = true;
        }
      } else if (this.type === 'tag') {
        limit_length($(this));
      } else {
        $(this).remove(); // comment?
      }
    });
  }

  // remove all quotes and post snippets
  ast.find('.quote').each(function () {
    $(this).remove();
  });

  // replace images/attachments with placeholders
  ast.find('.image, .attach').each(function () {
    var template = $(this).hasClass('attach') ? attachTpl : imageTpl;

    $(this).replaceWith(template({ href: $(this).data('nd-orig') }));
  });

  // replace media players with their urls
  ast.find('.ez-block').each(function () {
    $(this).replaceWith(blockLinkTpl({
      href:    $(this).data('nd-orig'),
      content: beautify($(this).data('nd-orig'), 50)
    }));
  });

  // remove all tags except whitelisted (a, em, del, etc.)
  remove_tags(ast);

  // cut any text after MAX_TEXT_LENGTH characters
  limit_length(ast);

  return ast.html();
}

module.exports = shorten;
