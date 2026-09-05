let sequence = 0;
export function send(method, params = {}) {
  const message = { id: `idel_${++sequence}`, method, params };
  console.log('IDEL:' + JSON.stringify(message));
  window.dispatchEvent(new CustomEvent('idel-command', { detail: message }));
}
export function log(msg) {
  console.log('IDEL:DEBUG ' + msg);
}
