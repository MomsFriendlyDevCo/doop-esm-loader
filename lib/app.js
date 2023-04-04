/**
* Basic implementation of a global `app` object
* If `global.app` doesn't already exist its instanciated from this base class
*
* This is used as a emitter to attach to if any Doop blocks contain a `on` specifier
*
* This is a very basic bare-bones app object which is expected to be sub-classed by something more specific to purpose
*/

import Debug from 'debug';
import Eventer from '@momsfriendlydevco/eventer';

const debug = Debug('doop');

export class DoopApp {


	/**
	* Indicates if this instance exists within a produciton environment
	* If this is the case some dev checks are skipped
	* @type {Boolean}
	*/
	isProduction = process.NODE_ENV == 'production';


	/**
	* Scan over all events and try to execute them in a logical order
	* This function is expected to be subclassed by something more specific to purpose
	*
	* Note: The sequence executed automatically gets decorated with `pre*` and `post*` at each stage
	*       e.g. if sequence=['stuff'] the actual emitters map to ['preStuff', 'stuff', 'postStuff']
	*
	* @param {Array<String>} [sequence] The sequence to execute, defaults to `init,middleware,endpoint,server,ready` if omitted
	* @returns {Promise} A promise which resolves when all emitters have completed
	*/
	emitSequence(sequence) {
		sequence ||= ['init', 'middleware', 'endpoint', 'server', 'ready'];

		debug('EmitSequence');
		return sequence
			.flatMap(stage => [
				'pre' + stage.substr(0, 1).toUpperCase() + stage.substr(1),
				stage,
				'post' + stage.substr(0, 1).toUpperCase() + stage.substr(1),
			])
			.reduce((acc, stage) => // Series promise for all stages
				acc.then(()=> this.emit(stage, this))
			, Promise.resolve())
	}


	/**
	* Simple method to extend the App prototype while also checking for conflicts
	* @param {Object} mixin The mixin object to extend by
	* @param {Object} [options] Additional options to mutate behaviour
	* @param {Boolean} [options.overwrite=false] Allow overwriting of existing keys
	* @returns {Object} This chainable instance
	*/
	extend(mixin, options) {
		let settings = {
			overwrite: false,
			...options,
		};

		if (!settings.overwrite && this.isProduction)
			Object.keys(mixin)
				.forEach(key => {
					if (this[key]) throw new Error(`The key "${key}" is already specifed in global.app - either specify {overwrite:true} or resolve the conflict`);
				})

		Object.assign(this, mixin);

		return this;
	}


	/**
	* Base constructor
	* Extend this instance with eventer
	*/
	constructor() {
		Eventer.extend(this);
	}
}

if (!global.app) {
	console.warn('Initalizing base DoopApp for the first time');
	global.app = new DoopApp();
}
