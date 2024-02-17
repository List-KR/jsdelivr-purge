import got from 'got'
import ipRegex from 'ip-regex'

export async function GetIPAddress(): Promise<string> {
	const ResponseRAW = await got('https://checkip.amazonaws.com/', {
		https: {
			minVersion: 'TLSv1.3',
			ciphers: 'TLS_AES_256_GCM_SHA384:TLS_CHACHA20_POLY1305_SHA256',
		},
		http2: true,
		headers: {
			'user-agent': 'jsdelivr-purge',
		},
	}).text()

	return (ipRegex().exec(ResponseRAW))?.[0] ?? 'UNKNWON'
}
