import type { Config } from '@react-router/dev/config';

const isNetlifyStaticBuild = process.env.NETLIFY === 'true';

export default {
	appDirectory: './src/app',
	ssr: !isNetlifyStaticBuild,
} satisfies Config;
