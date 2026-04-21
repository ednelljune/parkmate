async function upload({ url, buffer, base64 }) {
	const response = await fetch(`https://create.xyz/api/v0/upload`, {
		method: 'POST',
		headers: {
			'Content-Type': buffer ? 'application/octet-stream' : 'application/json',
		},
		body: buffer ? buffer : JSON.stringify({ base64, url }),
	});

	if (!response.ok) {
		try {
			const data = await response.json();
			throw new Error(data?.error || data?.message || 'Upload failed');
		} catch (parseError) {
			const text = await response.text();
			throw new Error(text || 'Upload failed');
		}
	}

	let data;
	try {
		data = await response.json();
	} catch (parseError) {
		const text = await response.text();
		throw new Error(text || 'Upload response invalid');
	}

	if (!data?.url) {
		throw new Error(data?.error || data?.message || 'Upload response missing file URL');
	}

	return {
		url: data.url,
		mimeType: data.mimeType || null,
	};
}

export default upload;
