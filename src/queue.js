/**
 * @global
 */
class Queue {

	constructor() {
		this._items = []
		this._pendingPromise = false
	}

	/**
	 * @param   {function} action
	 * @returns {Promise}
	 */
	enqueue(action) {
		return new Promise((resolve, reject) => {
			this.items.push({ action, resolve, reject })
			this.dequeue()
		})
	}

	async dequeue() {
		if (this.pendingPromise) {
		 return false
		}
		const item = this.items.shift()
		if (!item) {
			return false
		}
		try {
		 this._pendingPromise = true
		 const payload = await item.action(this)
		 this._pendingPromise = false
		 item.resolve(payload)
		} catch (ex) {
			this._pendingPromise = false
			item.reject(ex)
		} finally {
			this.dequeue()
		}
		return true
	}

	/**
	 * @readonly
	 * @type {array}
	 */
	get items() {
		return this._items
	}

	/**
	 * @readonly
	 * @type {boolean}
	 */
	get pendingPromise() {
		return this._pendingPromise
	}

}

export default Queue
