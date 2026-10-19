// A browser has one role. Only BrowserSession owns the network/cache in hub mode.
let handler = null;
export function setDataGateway(next) { handler = next; }
export function throughDataGateway(path, options, direct) {
  return handler ? handler(path, options) : direct(path, options);
}
