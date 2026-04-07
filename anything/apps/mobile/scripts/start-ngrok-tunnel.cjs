const ngrok = require('@expo/ngrok');

const port = Number.parseInt(process.argv[2] || '4200', 10);

(async () => {
  const url = await ngrok.connect({ addr: port });
  console.log(url);
  setInterval(() => {}, 1 << 30);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
