import fs from 'fs'
import crypto from 'crypto'
import http from 'http'
import https from 'https'

export function download(url, filePath) {
	const protocol = !url.charAt(4).localeCompare('s') ? https : http

	return new Promise((resolve, reject) => {
		const file = fs.createWriteStream(filePath)
		let fileInfo = null
		const request = protocol.get(url, response => {
			if (response.statusCode !== 200) {
				reject(new Error(`Failed to get '${url}' (${response.statusCode})`))
				return
			}
			fileInfo = {
				mime: response.headers['content-type'],
				size: parseInt(response.headers['content-length'], 10),
			}
			response.pipe(file)
		})
		file.on('finish', () => resolve(fileInfo))
		request.on('error', error => {
			fs.unlink(filePath, () => reject(error))
		})
		file.on('error', error => {
			fs.unlink(filePath, () => reject(error))
		})
		request.end()
	})
}

export function md5Remote (url) {
	const protocol = !url.charAt(4).localeCompare('s') ? https : http
	return new Promise((resolve, reject) => {
		const output = crypto.createHash('md5')
		const request = protocol.get(url, response => {
			if (response.statusCode !== 200) {
				reject(new Error(`Failed to get '${url}' (${response.statusCode})`))
				return
			}
			response.pipe(output)
		})
		request.on('error', error => {
			reject(error)
		})
		output.once('readable', () => {
			resolve(output.read().toString('hex'))
		})
	})
}
