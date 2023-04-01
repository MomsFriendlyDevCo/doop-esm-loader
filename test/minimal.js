import {expect} from 'chai';
import DoopParser from '#lib/parser';
import {dirName} from '@momsfriendlydevco/es6';

describe('@doop/esm-loader - minimal block test', ()=> {

	it('parse a basic example', ()=> {
		let testPath = `${dirName('..')}/test/data/minimal.doop`;

		return new DoopParser(testPath)
			.parse()
			.then(parser => {
				expect(parser.blocks).to.be.an('object');

				expect(parser.blocks).to.be.deep.equal({
					'script0': {
						id: 'script0',
						tag: 'script',
						attrs: {},
						lineStart: 2,
						lineEnd: 2,
						source: ["console.log('Hello World');"],
						sourceHeaders: [],
					},
				});
			})
	})

});
