// The admin upload server only runs on the developer's machine, so the admin
// UI is offered only there. On a deployed site it would just show an error.
const host = typeof window !== 'undefined' ? window.location.hostname : '';
export const ADMIN_AVAILABLE = ['localhost', '127.0.0.1', '[::1]'].includes(host)
  || host.endsWith('.localhost');
