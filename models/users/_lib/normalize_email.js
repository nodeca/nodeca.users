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


module.exports = function normalize_email(email) {
  let email_parts = email.split('@');

  let domain = email_parts.pop();
  let user = email_parts.join('@');

  // lowercase
  user = user.toLowerCase();

  // remove all dots, not significant for gmail
  user = user.replace(/\./g, '');

  // remove gmail mailboxes
  if (user[0] !== '+') user = user.replace(/\+.*/g, '');

  // lowercase
  domain = domain.toLowerCase();

  // aliases (TODO: mail.ru, yandex.ru have many of those)
  if (domain === 'googlemail.com') domain = 'gmail.com';

  return user + '@' + domain;
};
