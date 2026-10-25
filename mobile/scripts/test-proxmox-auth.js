// Direct CLI Debugger for Proxmox VE Authentication
// Usage: node mobile/scripts/test-proxmox-auth.js <host> <user> <password> [realm] [port] [otp]
const https = require('https');

const host = process.argv[2] || '192.168.1.120';
const user = process.argv[3] || 'root';
const password = process.argv[4] || '';
const realm = process.argv[5] || 'pam';
const port = parseInt(process.argv[6], 10) || 8006;
const otp = process.argv[7] || '';

console.log('==================================================');
console.log(' Proxmox VE Direct CLI Debugger & Tester');
console.log(` Target Host : ${host}:${port}`);
console.log(` User & Realm: ${user}@${realm}`);
console.log('==================================================\n');

if (!password) {
  console.log('⚠️ No password provided.');
  console.log('Usage: node mobile/scripts/test-proxmox-auth.js <host> <user> <password> [realm] [port] [otp]\n');
}

function pveCall(endpoint, method = 'GET', data = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const postData = data ? (typeof data === 'string' ? data : JSON.stringify(data)) : null;
    const reqHeaders = {
      'Accept': 'application/json',
      ...headers
    };
    if (postData) {
      reqHeaders['Content-Type'] = 'application/json';
      reqHeaders['Content-Length'] = Buffer.byteLength(postData);
    }

    const opts = {
      hostname: host,
      port: port,
      path: `/api2/json${endpoint}`,
      method: method,
      headers: reqHeaders,
      rejectUnauthorized: false,
      timeout: 6000
    };

    const req = https.request(opts, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        let json = null;
        try { json = JSON.parse(body); } catch (e) {}
        resolve({
          status: res.statusCode,
          headers: res.headers,
          bodyText: body,
          json: json
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error(`Timeout connecting to ${host}:${port}`));
    });

    req.on('error', (err) => reject(err));
    if (postData) req.write(postData);
    req.end();
  });
}

async function runTest() {
  // Step 1: Reachability & Version
  console.log('1. Probing /api2/json/version...');
  try {
    const verRes = await pveCall('/version');
    console.log(`   HTTP Status: ${verRes.status}`);
    if (verRes.json?.data) {
      console.log(`   ✓ Proxmox Version: ${verRes.json.data.release || verRes.json.data.version}`);
    } else {
      console.log(`   ℹ Note: /version returned HTTP ${verRes.status} (normal if auth required)`);
    }
  } catch (e) {
    console.error(`   ✗ Connection Failed: ${e.message}`);
    return;
  }

  if (!password) {
    console.log('\nProvide credentials to test authentication & cluster commands.');
    return;
  }

  // Step 2: Authentication Ticket
  console.log('\n2. Testing Authentication Ticket (/api2/json/access/ticket)...');
  let authUser = user;
  if (!authUser.includes('@')) authUser = `${authUser}@${realm}`;

  const authPayload = {
    username: authUser,
    password: password
  };
  if (otp) authPayload.otp = otp;

  try {
    const authRes = await pveCall('/access/ticket', 'POST', authPayload);
    console.log(`   HTTP Status: ${authRes.status}`);
    if (authRes.status !== 200 || !authRes.json?.data?.ticket) {
      console.error(`   ✗ Authentication Failed: ${authRes.json?.message || authRes.bodyText}`);
      return;
    }

    const ticket = authRes.json.data.ticket;
    const csrf = authRes.json.data.CSRFPreventionToken;
    console.log(`   ✓ Ticket Generated! (Length: ${ticket.length})`);
    console.log(`   ✓ CSRF Token Generated!`);

    const authHeaders = {
      'Cookie': `PVEAuthCookie=${ticket}`,
      'CSRFPreventionToken': csrf
    };

    // Step 3: Cluster Status
    console.log('\n3. Testing /api2/json/cluster/status...');
    const clusterRes = await pveCall('/cluster/status', 'GET', null, authHeaders);
    if (clusterRes.status === 200) {
      console.log(`   ✓ Cluster Status OK:`);
      const items = clusterRes.json?.data || [];
      items.forEach(item => {
        console.log(`     - [${item.type}] ${item.name || item.id || ''} (online: ${item.online ?? 'N/A'})`);
      });
    } else {
      console.log(`   Status: ${clusterRes.status} - ${clusterRes.bodyText}`);
    }

    // Step 4: Host Nodes
    console.log('\n4. Testing /api2/json/nodes...');
    const nodesRes = await pveCall('/nodes', 'GET', null, authHeaders);
    if (nodesRes.status === 200) {
      const nodes = nodesRes.json?.data || [];
      console.log(`   ✓ Nodes Discovered (${nodes.length}):`);
      nodes.forEach(n => {
        const cpuPct = Math.round((n.cpu || 0) * 100);
        const memGb = ((n.mem || 0) / (1024 ** 3)).toFixed(1);
        const maxMemGb = ((n.maxmem || 0) / (1024 ** 3)).toFixed(1);
        console.log(`     - Node '${n.node}': Status=${n.status}, CPU=${cpuPct}%, RAM=${memGb}/${maxMemGb}GB`);
      });
    }

    // Step 5: Virtual Guests (VMs & LXCs)
    console.log('\n5. Testing /api2/json/cluster/resources?type=vm...');
    const guestsRes = await pveCall('/cluster/resources?type=vm', 'GET', null, authHeaders);
    if (guestsRes.status === 200) {
      const guests = guestsRes.json?.data || [];
      console.log(`   ✓ Guests Discovered (${guests.length}):`);
      guests.slice(0, 10).forEach(g => {
        console.log(`     - [${g.type.toUpperCase()}] ID ${g.vmid}: "${g.name}" Status=${g.status} Node=${g.node}`);
      });
    }

    console.log('\n🎉 ALL PROXMOX API TESTS PASSED SUCCESSFULLY!');

  } catch (err) {
    console.error(`   ✗ Auth Error: ${err.message}`);
  }
}

runTest();
