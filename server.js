import fs from "fs"
import path from "path"
import http from "http"

import MongoDB from "mongodb"
import puppeteer from "puppeteer"
import WS from "ws"
import tracer from "tracer"
import express from "express"
import cors from "cors"

import config from "./lib/config.js"

import CurrencyConverter from "./src/currency-converter.js"
import Engine from "./src/engine.js"
import Source from "./src/source.js"
import Transaction from "./src/transaction.js"

import Taobao from "./src/source/taobao.js"
import _1688 from "./src/source/1688.js"

import { RateLimiterMemory } from "rate-limiter-flexible"

const consoleLogger = tracer.colorConsole({	format : "{{message}}" })

const logger = tracer.dailyfile({
		root: "./logs",
		maxLogFiles: 10,
		format: "{{timestamp}} {{message}}",
		dateformat: "HH:MM:ss",
		splitFormat: "yyyymmdd",
		allLogsFileName: "server",
		transport: function (data) {
			consoleLogger[data.title](data.output)
		},
})

const rateLimiter = new RateLimiterMemory({
	points: 5,
	duration: 2,
})

logger.log("[database] Loading ...")

const _client = await MongoDB.MongoClient.connect(config.DATABASE_URL, { useUnifiedTopology: true })
const _database = _client.db(config.DATABASE_NAME)

logger.log("[browser] Loading...")

const browser = await puppeteer.launch({
	headless: true,
	args: [
		"--no-sandbox",
		"--disable-setuid-sandbox",
		"--ignore-certificate-errors"
	]
})

logger.log("[currency converter] Loading...")

const currencyConverter = new CurrencyConverter(browser, logger)
await currencyConverter.load("CNY", "BRL")
setInterval(function refreshRate() {
	logger.log("[currency converter] Refreshing exchange rate...")
	currencyConverter.setCurrencyPair("CNY", "BRL")
}, 60 * 60000)

const engine = new Engine(browser, currencyConverter, logger, _database)

logger.log("[1688] Loading...")

const _1688_ = new _1688(engine)
await _1688_.load()

logger.log("[taobao] Loading...")

const taobao = new Taobao(engine)
await taobao.load()

const app = express()

app.use(cors())

app.get("/currency-rate", function (req, res) {
	res.json(currencyConverter.rate)
})

app.use("*", (req, res) => res.connection.destroy())

const server = app.listen(config.PORT, function () {
	logger.info(`Ready and listening on ${config.PORT}`)
})

server.on("upgrade", async (request, socket, head) => {
	try {
		await rateLimiter.consume(request.socket.remoteAddress)
		webSocketServer.handleUpgrade(request, socket, head, socket => {
			webSocketServer.emit("connection", socket, request)
		})
	} catch(ex) {
		socket.destroy()
		logger.error(ex)
	}
})

const webSocketServer = new WS.Server({ noServer: true  })

const cleanInterval = setInterval(async () => {
	for(const webSocket of webSocketServer.clients) {
		if (webSocket.isAlive === false) {
			logger.log(`Terminating ${webSocket.remoteAddress} (Cause: did not answer ping)`)
			return webSocket.terminate()
		}
		webSocket.isAlive = false
		logger.log(`Sending ping to ${webSocket.remoteAddress}`)
		webSocket.send("ping")
	}
}, 30000)

webSocketServer.on("connection", function(webSocket, request) {

	webSocket.remoteAddress = request.socket.remoteAddress
	logger.log(`(${request.socket.remoteAddress}) Connected`)

	const transaction = new Transaction(engine, webSocket)

	webSocket.isAlive = true

	webSocket.on("message", async function(message) {

		try {
			await rateLimiter.consume(request.socket.remoteAddress)
		} catch(ex) {
			logger.error(ex)
		}

		try {
			if(message === "pong") {
				logger.log(`(${request.socket.remoteAddress}) pong`)
				webSocket.isAlive = true
			} else {
				let json
				try {
					json = JSON.parse(message)
				} catch(ex) {
					logger.log(`(${request.socket.remoteAddress}) Unknown message received: ${message.length >= 20 ? `${message.slice(0, 20)} (truncated: original size: ${message.length})` : message }`)
					return
				}
				const { query, data } = json
				logger.log(`(${request.socket.remoteAddress}) Received query: ${query}`)
				if(query === "search" && typeof data.imageURL === "string" && typeof data.sourceName === "string") {
					transaction.data.imageURL = data.imageURL
					let source
					if(data.sourceName === "1688") {
						source = _1688_
					} else if(data.sourceName === "taobao") {
						source = taobao
					}
					if(source) {
						transaction.data.source = source
						source.enqueue(transaction)
						transaction.send({ query: "status", data: `Queuing request: Your position is ${source.queue.items.length}...` })
					}
				}
			}
		} catch(ex) {
			logger.error(ex)
		}
	})

	webSocket.on("close", async function() {
		logger.log(`(${request.socket.remoteAddress}) Disconnected`)
	})

	webSocket.on("error", async function(error) {
		logger.error(`(${request.socket.remoteAddress}) An error occured:`, error)
	})

})

webSocketServer.on("close", () => clearInterval(cleanInterval))

