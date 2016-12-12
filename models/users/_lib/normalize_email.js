// Normalize email address to ensure that a user can't register twice
// with the variations of the same email.
//
// The algorithm is as follows:
//
//  1. User name normalization
//
//     - lowercase
//     - remove mailbox extensions (google uses '+', yahoo uses '-',
//       we remove only '+' because don't have any yahoo users)
//     - *not implemented*: convert unicode to ascii (remove accents,
//       diacritics, etc.)
//     - remove padding characters (we remove '.' for all domains)
//
//  2. Domain name normalization
//
//     - lowercase
//     - *not implemented*: convert to punycode
//     - change aliases to primary domain (googlemail.com -> gmail.com)
//     - *not implemented*: remove 3rd level domain
//       (email.msn.com -> msn.com, but not for mail.co.uk)
//
// This module should only be used for uniqueness check, all emails
// should still go to the exact mailbox specified by the user.
//
// This module does not guarantee that normalized emails are actually the same
// (e.g. we delete all dots, but `test@example.com` can be different from
// `te.st@example.com`), so do not use this as an alias for logging in.
//
// Here's a relevant article about email normalization and verification:
// http://girders.org/blog/2013/01/31/dont-rfc-validate-email-addresses/
//

'use strict';

const punycode = require('punycode');


function normalize_gmail(username) {
  // lowercase
  username = username.toLowerCase();

  // remove all dots, not significant for gmail
  username = username.replace(/\./g, '');

  // remove gmail mailboxes
  username = username.replace(/\+.*/g, '');

  return username;
}


function normalize_yahoo(username) {
  // lowercase
  username = username.toLowerCase();

  // remove yahoo mailboxes
  username = username.replace(/\-.*/g, '');

  return username;
}


function normalize_yandex(username) {
  // lowercase
  username = username.toLowerCase();

  // '.' is an alias for '-'
  // https://yandex.com/support/mail/faq.xml#mail-aliases
  username = username.replace(/-/g, '.');

  return username;
}


function normalize_mailru(username) {
  return username.toLowerCase();
}


function normalize_generic(username) {
  // lowercase
  username = username.toLowerCase();

  // remove mailboxes
  username = username.replace(/\+.*/g, '');

  return username;
}


let rules = {
  'gmail.com': {
    aliases: [ 'googlemail.com' ],
    fn: normalize_gmail
  },
  'yahoo.net': {
    aliases: [ 'yahoodns.com', 'ymail.com' ],
    fn: normalize_yahoo
  },
  'yandex.com': {
    aliases: [ 'yandex.ru', 'narod.ru', 'yandex.ua', 'yandex.by', 'yandex.kz', 'ya.ru' ],
    fn: normalize_yandex
  },
  'mail.ru': {
    aliases: [ 'list.ru', 'inbox.ru' ],
    fn: normalize_mailru
  },
  'default': { fn: normalize_generic }
};


module.exports = function normalize_email(email_str) {
  let email_parts = email_str.split('@');

  let domain = email_parts.pop();
  let username = email_parts.join('@');

  // lowercase domain
  domain = domain.toLowerCase();

  // punycode should get normalized domain (i.e. after lowercase)
  domain = punycode.toASCII(domain);

  for (let r of Object.keys(rules)) {
    if (r === domain || rules[r].aliases && rules[r].aliases.indexOf(domain) !== -1) {
      username = rules[r].fn(username);
      domain = r;

      return username + '@' + domain;
    }
  }

  username = rules.default.fn(username);

  return username + '@' + domain;
};
