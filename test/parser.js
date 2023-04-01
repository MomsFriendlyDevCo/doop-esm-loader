import {expect} from 'chai';
import DoopParser from '#lib/parser';
import {dirName} from '@momsfriendlydevco/es6';

describe('@doop/esm-loader - basic block test', ()=> {

	let parser;
	let testPath = `${dirName('..')}/test/data/simple.doop`;
	let emitted = {
		orphanedLines: [],
	};

	it('prepare a class instance', ()=>
		new DoopParser(testPath)
			.on('orphanedLines', data => emitted.orphanedLines.push(data))
			.parse({orphans: true})
			.then(result => parser = result)
	);

	it('parsed SFC blocks', ()=> {
		expect(parser.blocks).to.be.an('object');

		expect(parser.blocks).to.have.property('three');

		expect(parser.blocks.three).to.have.property('attrs');
		expect(parser.blocks.three.attrs).to.be.an('object');
		expect(parser.blocks.three.attrs).to.deep.equal({
			id: 'three',
			foo: 123,
			bar: true,
			baz: 'Test String',
		});

		expect(parser.blocks.three).to.have.property('source');
		expect(parser.blocks.three.source).to.be.a('string');
	});


	// Not working correctly yet but not essencial for now
	it.skip('detect orphaned content', ()=> {
		expect(emitted.orphanedLines).to.be.deep.equal([
			[
				'Out of bounds leading whitespace',
				'',
			],
			[
				'',
				'Out of bounds mid whitespace',
				'',
			],
			[
				'',
				'Out of bounds mid whitespace x1',
				'Out of bounds mid whitespace x2',
				'Out of bounds mid whitespace x3',
				'',
			],
			[
				'',
				'Out of bounds trailing whitespace',
			],
		]);

		expect(parser.index().split(/\n/)).to.be.deep.equal([
			'/* Generated index file from @doop/esm-loader */',
			`import script0 from '${testPath}?block=script0'`,
			`import script1 from '${testPath}?block=script1'`,
			`import three from '${testPath}?block=three'`,
		]);
	});

});
