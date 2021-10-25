/**
 * @global
 */
class Transaction {

	/**
	 * @param {Engine} engine
	 * @param {WebSocket} webSocket
	 */
	constructor(engine, webSocket) {
		this._engine = engine
		this._webSocket = webSocket
		this._data = {}
	}

	/**
	 * @param {object} data
	 */
	send(data) {
		this.webSocket.send(JSON.stringify(data))
	}

	/**
	 * @readonly
	 * @type {Engine}}
	 */
	get engine() {
		return this._engine
	}

	/**
	 * @readonly
	 * @type {WebSocket}
	 */
	get webSocket() {
		return this._webSocket
	}

	/**
	 * @readonly
	 * @type {object}
	 */
	get data() {
		return this._data
	}

}

export default Transaction
