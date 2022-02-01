'use strict';

const assert    = require('assert');
const normalize = require('nodeca.users/models/users/_lib/normalize_email');


describe('normalize_email', function () {
  it('should accept RFC3696 emails', function () {
    // https://tools.ietf.org/html/rfc3696
    assert.equal(normalize('user+mailbox@example.com'), 'user@example.com');
    assert.equal(normalize('customer/department=shipping@example.com'), 'customer/department=shipping@example.com');
    assert.equal(normalize('$A12345@example.com'), '$a12345@example.com');
    assert.equal(normalize('!def!xyz%abc@example.com'), '!def!xyz%abc@example.com');
    assert.equal(normalize('_somename@example.com'), '_somename@example.com');
  });


  it('should normalize yandex emails', function () {
    // https://yandex.com/support/mail/faq.xml#mail-aliases
    assert.equal(normalize('Capt.kirk@Yandex.ru'), 'capt.kirk@yandex.com');
    assert.equal(normalize('Capt.kirk@Yandex.com'), 'capt.kirk@yandex.com');
    assert.equal(normalize('Capt-kirk@Yandex.com'), 'capt.kirk@yandex.com');
  });


  it('should normalize mail.ru emails', function () {
    assert.equal(normalize('test@mail.ru'), 'test@mail.ru');
    assert.equal(normalize('test@inbox.ru'), 'test@mail.ru');
    assert.equal(normalize('test@list.ru'), 'test@mail.ru');
  });


  it('should normalize gmail emails', function () {
    assert.equal(normalize('Foo.bar+mailbox@Gmail.com'), 'foobar@gmail.com');
    assert.equal(normalize('Foo.bar+mailbox@Googlemail.com'), 'foobar@gmail.com');
  });


  it('should normalize yahoo emails', function () {
    assert.equal(normalize('Foo-mailbox@Yahoo.net'), 'foo@yahoo.net');
    assert.equal(normalize('Foo-mailbox@Ymail.com'), 'foo@yahoo.net');
  });


  it('should punycode domain correctly', function () {
    assert.equal(normalize('test@Кц.Рф'), 'test@xn--j1ay.xn--p1ai');
  });
});
