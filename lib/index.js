import create from 'create-esm-loader';

// Base loader for node-esm-loader
import config from './loader.js';

// Stand-alone loader
export const {
	resolve,
	getFormat,
	getSource,
	transformSource,
	load,
} = await create(config);
