// Lets node:test import components that use CSS. Modules map each class to its own name; plain CSS is empty.
import { registerHooks } from 'node:module';

registerHooks({
  load(url, context, nextLoad) {
    if (url.endsWith('.module.css'))
      return {
        format: 'module',
        source: 'export default new Proxy({}, { get: (_, key) => String(key) });',
        shortCircuit: true,
      };
    if (url.endsWith('.css')) return { format: 'module', source: '', shortCircuit: true };
    return nextLoad(url, context);
  },
});
