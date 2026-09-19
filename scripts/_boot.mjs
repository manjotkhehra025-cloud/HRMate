// Boots the HRMate API in-process on an ephemeral port so the test suites can
// run standalone (no separate `npm run server` needed).
export async function bootServer() {
  process.env.HRMATE_TEST = '1'; // server/index.js skips its own listen()
  const { server } = await import('../server/index.js');
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  return {
    base: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

/** Tiny assertion harness shared by the suites. */
export function harness() {
  const state = { pass: 0, fail: 0 };
  const extra_ = (x) => {
    try {
      return typeof x === 'function' ? x() : String(x ?? '');
    } catch (e) {
      return `<extra error: ${e.message}>`;
    }
  };
  return {
    state,
    check: (cond, name, extra = '') => {
      if (cond) {
        state.pass += 1;
        console.log(`  ok   ${name}${extra_(extra) ? ` — ${extra_(extra)}` : ''}`);
      } else {
        state.fail += 1;
        console.log(`  FAIL ${name} — ${extra_(extra)}`);
      }
    },
    summary: () => {
      console.log(`\n${state.pass} passed, ${state.fail} failed`);
      return state.fail;
    }
  };
}

export async function login(base, email, password = 'Demo@1234') {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  const json = await res.json();
  if (!json.token) throw new Error(`login failed for ${email}: ${JSON.stringify(json)}`);
  return { token: json.token, me: json.employee, company: json.company };
}

export async function call(base, token, method, path, body) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
    body: body ? JSON.stringify(body) : undefined
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    /* empty body */
  }
  return { status: res.status, j: json };
}
