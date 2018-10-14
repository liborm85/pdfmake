'use strict';

var assert = require('assert');
var rewire = require("rewire");

var DocumentContext = rewire('../js/documentContext');

describe('DocumentContext', function () {
	var pc;

	beforeEach(function () {
		pc = new DocumentContext.default({width: 400, height: 800, orientation: 'portrait'}, {left: 40, right: 40, top: 60, bottom: 60});
		// pc.addPage();
	});


	describe('beginColumnGroup', function () {
		it('should save current settings', function () {
			pc.beginColumnGroup();
			pc.x = 80;
			pc.page = 3;

			assert.equal(pc.snapshots.length, 1);
			assert.equal(pc.snapshots[0].x, 40);
			assert.equal(pc.snapshots[0].page, 0);
		});
	});

	describe('beginColumn', function () {
		it('should set y, page and availableHeight back to the values stored in beginColumnGroup', function () {
			pc.beginColumnGroup();
			pc.y = 150;
			pc.page = 5;
			pc.availableHeight = 123;

			pc.beginColumn();

			assert.equal(pc.y, 60);
			assert.equal(pc.page, 0);
			assert.equal(pc.availableHeight, 800 - 60 - 60);
		});

		it('should add offset to current x', function () {
			pc.beginColumnGroup();
			pc.beginColumn(50, 30);

			assert.equal(pc.x, 40 + 30);
		});

		it('should add previous column widths to x when starting a new column', function () {
			pc.beginColumnGroup();
			pc.beginColumn(30);
			assert.equal(pc.x, 40);
			pc.beginColumn(20);
			assert.equal(pc.x, 40 + 30);
		});

		it('should set availableWidth to the specified column width', function () {
			pc.beginColumnGroup();
			pc.beginColumn(30);

			assert.equal(pc.availableWidth, 30);
		});

		it('should save context in endingCell if provided', function () {
			var endingCell = {};
			pc.beginColumnGroup();
			pc.beginColumn(30, 0, endingCell);
			pc.y = 150;
			pc.page = 3;
			pc.availableHeight = 123;
			pc.beginColumn(30, 0);

			assert.equal(endingCell._columnEndingContext.y, 150);
			assert.equal(endingCell._columnEndingContext.page, 3);
			assert.equal(endingCell._columnEndingContext.availableHeight, 123);
		});
	});

	describe('completeColumnGroup', function () {
		it('should set x to the value stored in beginColumnGroup', function () {
			pc.beginColumnGroup();
			pc.x = 150;
			pc.completeColumnGroup();

			assert.equal(pc.x, 40);
		});

		it('should set page to the value pointing to the end of the longest column', function () {
			pc.beginColumnGroup();
			pc.beginColumn(30);
			pc.page = 3;
			pc.beginColumn(30);
			pc.page = 7;
			pc.beginColumn(30);
			pc.page = 4;
			pc.completeColumnGroup();

			assert.equal(pc.page, 7);
		});

		it('should skip non-ending-cells (spanning over multiple rows) during vsync', function () {
			var endingCell = {};

			pc.beginColumnGroup();
			pc.beginColumn(30, 0, endingCell);
			pc.y = 150;
			pc.page = 3;
			pc.availableHeight = 123;
			pc.beginColumn(30, 0);
			pc.y = 100;
			pc.page = 3;
			pc.completeColumnGroup();

			assert.equal(pc.page, 3);
			assert.equal(pc.y, 100);
		});

		it('non-ending-cells (spanning over multiple rows) should also work with nested columns', function () {
			var endingCell = {};
			var endingCell2 = {};

			// external table
			pc.beginColumnGroup();
			// col1 spans over 2 rows
			pc.beginColumn(30, 0, endingCell);
			pc.y = 350;
			pc.beginColumn(40);
			pc.y = 100;
			// column3 contains a nested table
			pc.beginColumn(100);

			pc.beginColumnGroup();
			pc.beginColumn(20);
			pc.y = 100;
			pc.beginColumn(20);
			pc.y = 120;
			// col3.3 spans over 2 rows
			pc.beginColumn(40, 0, endingCell2);
			pc.y = 180;
			pc.completeColumnGroup();

			//// bottom of all non-spanned columns
			assert.equal(pc.y, 120);

			// second row (of nested table)
			pc.beginColumnGroup();
			pc.beginColumn(20);
			pc.y = 10;
			pc.beginColumn(20);
			pc.y = 20;
			// col3.3 spans over 2 rows
			pc.beginColumn(40, 0);
			pc.markEnding(endingCell2);
			pc.completeColumnGroup();

			//// spanned column was large enough to influence bottom
			assert.equal(pc.y, 180);
			pc.completeColumnGroup();

			//// bottom of all non-spanned columns
			assert.equal(pc.y, 180);

			// second row
			pc.beginColumnGroup();
			pc.beginColumn(30);
			pc.markEnding(endingCell);
			pc.beginColumn(40);
			pc.y = 50;
			pc.beginColumn(100);
			pc.y = 10;
			pc.completeColumnGroup();
			assert.equal(pc.y, 350);
		});
	});


	describe('addPage', function () {

		var pageSize;

		beforeEach(function () {
			pageSize = {width: 200, height: 400, orientation: 'landscape'};
		});


		it('should keep column width when in column group, but set page width', function () {
			pc.beginColumnGroup();
			pc.beginColumn(100, 0, {});
			pc.initializePage();

			assert.equal(pc.availableWidth, 100);

			pc.completeColumnGroup();

			assert.equal(pc.availableWidth, 400 - 40 - 40);
		});
	});

	describe('bottomMostContext', function () {
		it('should return context with larger page if pages are different', function () {
			var result = DocumentContext.__get__('bottomMostContext')({page: 2, y: 10}, {page: 3, y: 5});
			assert.equal(result.page, 3);
			assert.equal(result.y, 5);
		});

		it('should return context with larger y if both contexts have the same page', function () {
			var result = DocumentContext.__get__('bottomMostContext')({page: 3, y: 100}, {page: 3, y: 50});
			assert.equal(result.page, 3);
			assert.equal(result.y, 100);
		});
	});

	it('should support nesting', function () {
		pc.beginColumnGroup();
		pc.beginColumn(50);
		pc.y = 200;
		pc.beginColumn(40);
		pc.y = 150;
		pc.beginColumn(80);

		pc.beginColumnGroup();

		assert.equal(pc.snapshots.length, 2);
		assert.equal(pc.snapshots[1].x, 40 + 50 + 40);

		pc.beginColumn(20);
		pc.y = 240;
		pc.page = 2;
		pc.beginColumn(20);
		pc.y = 260;
		pc.completeColumnGroup();

		assert.equal(pc.snapshots.length, 1);
		assert.equal(pc.x, 40 + 50 + 40);
		assert.equal(pc.page, 2);
		assert.equal(pc.y, 240);

		pc.completeColumnGroup();

		assert.equal(pc.snapshots.length, 0);
		assert.equal(pc.x, 40);
		assert.equal(pc.page, 2);
		assert.equal(pc.y, 240);
	});
});
