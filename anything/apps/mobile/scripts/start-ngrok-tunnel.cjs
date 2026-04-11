const ngrok = require('@expo/ngrok');

const port = Number.parseInt(process.argv[2] || '4200', 10);
const region = process.argv[3] || process.env.NGROK_REGION || undefined;
const authtoken = process.env.NGROK_AUTHTOKEN || undefined;
const configPath = process.env.NGROK_CONFIG || undefined;

const connectOptions = {
  addr: port,
  onLogEvent: (message) => {
    process.stderr.write(`${message}\n`);
  },
  onStatusChange: (status) => {
    process.stderr.write(`[ngrok] status=${status}\n`);
  },
};

if (region) {
  connectOptions.region = region;
}

if (authtoken) {
  connectOptions.authtoken = authtoken;
}

if (configPath) {
  connectOptions.configPath = configPath;
}

(async () => {
  const url = await ngrok.connect(connectOptions);
  process.stdout.write(`${url}\n`);
  setInterval(() => {}, 1 << 30);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
