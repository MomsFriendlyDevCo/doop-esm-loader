import {expect} from 'chai';
import {dirName} from '@momsfriendlydevco/es6';
import {execa} from 'execa';

describe('@doop/esm-loader - CLI test', ()=> {

	it('execute a simple Node program with the Doop loader', ()=> {
		let rootPath = dirName('..');
		let loaderPath = `${rootPath}/lib/index.js`;
		let testPath = `${rootPath}/test/data/cli.doop`;

		return execa('node', [
			`--loader=${loaderPath}`,
			testPath,
		])
			.then(({stdout, stderr}) => {
				console.log('OUT', stdout);
			})
	})

});
