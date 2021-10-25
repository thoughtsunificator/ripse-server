import Queue from "./queue.js"

/**
 * @global
 */
class Queuable {

	constructor() {
		this._queue = new Queue()
	}

	/**
	 * @abstract
	 */
	async task() {}

	enqueue() {
		return this.queue.enqueue(this.task.bind(this, ...arguments))
	}

	/**
	 * @readonly
	 * @type {Queue}}
	 */
	get queue() {
		return this._queue
	}

}

export default Queuable
