/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

// export default {
// 	async fetch(request, env, ctx) {
// 		return new Response('Hello World!');
// 	},
// };

export default {
	async fetch(request, env) {
		if (request.method === 'OPTIONS') {
			return new Response(null, {
				headers: {
					'Access-Control-Allow-Origin': '*',
					'Access-Control-Allow-Methods': 'POST, OPTIONS',
					'Access-Control-Allow-Headers': 'Content-Type',
				},
			});
		}

		const url = new URL(request.url);

		if (url.pathname === '/translate' && request.method === 'POST') {
			try {
				const { text, sourceLang, targetLang } = await request.json();
				if (!text?.trim()) return jsonResponse({ error: 'No text provided' }, 400);

				const response = await env.AI.run('@cf/meta/llama-3.1-8b-instruct', {
					messages: [
						{
							role: 'system',
							content: `You are a professional translator. Translate from ${sourceLang} to ${targetLang}. Output only the translation, nothing else.`,
						},
						{
							role: 'user',
							content: `Translate this from ${sourceLang} to ${targetLang}:\n\n${text}`,
						},
					],
					max_tokens: 512,
				});

				return jsonResponse({ translation: (response.response || '').trim() });
			} catch (err) {
				return jsonResponse({ error: err.message }, 500);
			}
		}

		return jsonResponse({ error: 'Not found' }, 404);
	},
};

function jsonResponse(data, status = 200) {
	return new Response(JSON.stringify(data), {
		status,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
		},
	});
}
