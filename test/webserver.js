import DoopParser from '#lib/parser';
import {dirName} from '@momsfriendlydevco/es6';
import EventEmitter from 'node:events';
import {expect} from 'chai';

describe('@doop/esm-loader - web server example', ()=> {

	let parser;
	let testPath = `${dirName('..')}/test/data/webserver.doop`;

	it('prepare a class instance', ()=>
		new DoopParser(testPath)
			.parse()
			.then(result => parser = result)
	);

	it('extracted blocks', ()=> {
		expect(parser.blocks).to.be.an('object');

		expect(parser.blocks).to.have.all.keys(
			'middleware0', 'middleware1',
			'endpoint0', 'endpoint1',
		);
	});

	it('generate index with emitter pattern', ()=> {
		let index = parser.index({
			wrap: ({path, block}) =>
				`app.on('${block.attrs.on}', ()=> import('${path}'));`,
		});

		expect(index).to.be.a('string');
		expect(index).to.match(/^app\.on\('middleware', \(\)=> import\(.+\)\);/m);
	});

	it.skip('invoke workers in the correct order', ()=> {
		let app = new EventEmitter;

		// FIXME: No idea how to test this stuff inline
		return import(parser.path)
	});

});
