import got from 'got'
import {isIP} from 'node:net'

export async function getIpAddress(): Promise<string> {
	const ipAddress = (await got('https://checkip.amazonaws.com/', {
		https: {
			minVersion: 'TLSv1.3',
			ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256',
		},
		http2: true,
		headers: {
			'user-agent': 'jsdelivr-purge',
		},
	}).text()).trim()

	return isIP(ipAddress) ? ipAddress : 'UNKNOWN'
}
