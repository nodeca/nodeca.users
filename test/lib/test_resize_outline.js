'use strict';


const assert         = require('assert');
const resize_outline = require('nodeca.users/lib/resize_outline');


describe('resize_outline', function () {
  describe('width only', function () {
    it('should resize image', function () {
      assert.deepEqual(
        resize_outline(1234, 202, { width: 200 }),
        { resize_width: 200, resize_height: 33, crop_width: 200, crop_height: 33 }
      );
    });

    it('should not inflate small image', function () {
      assert.deepEqual(
        resize_outline(123, 21, { width: 1000 }),
        { resize_width: 123, resize_height: 21, crop_width: 123, crop_height: 21 }
      );
    });
  });

  describe('height only', function () {
    it('should resize image', function () {
      assert.deepEqual(
        resize_outline(1001, 234, { height: 40 }),
        { resize_width: 171, resize_height: 40, crop_width: 171, crop_height: 40 }
      );
    });

    it('should not inflate small image', function () {
      assert.deepEqual(
        resize_outline(101, 23, { height: 40 }),
        { resize_width: 101, resize_height: 23, crop_width: 101, crop_height: 23 }
      );
    });
  });

  describe('width + height', function () {
    it('should resize horizontal image', function () {
      assert.deepEqual(
        resize_outline(1234, 202, { width: 170, height: 150 }),
        { resize_width: 170, resize_height: 28, crop_width: 170, crop_height: 28 }
      );
    });

    it('should resize vertical image', function () {
      assert.deepEqual(
        resize_outline(202, 1234, { width: 170, height: 150 }),
        { resize_width: 25, resize_height: 150, crop_width: 25, crop_height: 150 }
      );
    });

    it('should not inflate small horizontal image', function () {
      assert.deepEqual(
        resize_outline(123, 22, { width: 170, height: 150 }),
        { resize_width: 123, resize_height: 22, crop_width: 123, crop_height: 22 }
      );
    });

    it('should not inflate small vertical image', function () {
      assert.deepEqual(
        resize_outline(22, 123, { width: 170, height: 150 }),
        { resize_width: 22, resize_height: 123, crop_width: 22, crop_height: 123 }
      );
    });

    it('should scale horizontal image proportionally if only one dimension is below limits', function () {
      assert.deepEqual(
        resize_outline(234, 88, { width: 150, height: 150 }),
        { resize_width: 150, resize_height: 56, crop_width: 150, crop_height: 56 }
      );
    });

    it('should scale vertical image proportionally if only one dimension is below limits', function () {
      assert.deepEqual(
        resize_outline(88, 234, { width: 150, height: 150 }),
        { resize_width: 56, resize_height: 150, crop_width: 56, crop_height: 150 }
      );
    });
  });

  describe('no width, no height', function () {
    it('should resize image', function () {
      assert.deepEqual(
        resize_outline(1000, 200, { max_width: 170, max_height: 150 }),
        { resize_width: 750, resize_height: 150, crop_width: 170, crop_height: 150 }
      );
    });

    it('should not inflate small image', function () {
      assert.deepEqual(
        resize_outline(123, 23, { max_width: 170, max_height: 150 }),
        { resize_width: 123, resize_height: 23, crop_width: 123, crop_height: 23 }
      );
    });
  });
});
