// Set of functions used to check title
//
'use strict';


// Check if input contains too many consecutive uppercase letters
//
// Returns:
//  - true if there are 5+ consecutive uppercase letters
//  - false if not
//
function has_too_many_caps(input) {
  let cnt = 0;

  for (let chr of input) {
    if (chr.toLowerCase() !== chr && chr.toUpperCase() === chr) {
      cnt++;
      if (cnt >= 5) {
        return true;
      }
    } else {
      cnt = 0;
    }
  }

  return false;
}


// Check if input contains unicode emojis
//
// Returns:
//  - true if any emoji is found
//  - false if not
//

// https://en.wikipedia.org/wiki/Unicode_block
const emoji_blocks = [
  // Miscellaneous Symbols and Pictographs
  '\u{1F300}-\u{1F5FF}',
  // Emoticons
  '\u{1F600}-\u{1F64F}',
  // Transport and Map Symbols
  '\u{1F680}-\u{1F6FF}',
  // Supplemental Symbols and Pictographs
  '\u{1F900}-\u{1F9FF}',
  // Symbols and Pictographs Extended-A
  '\u{1FA70}-\u{1FAFF}'
];

const emoji_re = new RegExp('[' + emoji_blocks.join('') + ']', 'u');


module.exports.has_emoji = function has_emoji(input) {
  return emoji_re.test(input);
};


// Normalize title
//  - trim spaces
//  - if title ends with /!+/ or /?+/, reduce number of these chars to 1
//  - convert title to lowercase if title has too many (5+ consecutive) uppercase letters
//
module.exports.normalize_title = function normalize_title(input) {
  input = input.trim()
               .replace(/[?]+$/g, '?')
               .replace(/[!]+$/g, '!');

  if (has_too_many_caps(input)) input = input.toLowerCase();

  return input;
};
