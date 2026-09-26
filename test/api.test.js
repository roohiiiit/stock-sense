const assert = require('node:assert');
const app = require('../server/src/app');

async function runTests() {
  console.log('🧪 Starting StockSense Backend Automated Test Suite...');

  // Start temporary test server
  const server = app.listen(0);
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  let authToken = '';
  let testUserId = '';

  try {
    // 1. Health check
    console.log('  1. Testing GET /api/health');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthJson = await healthRes.json();
    assert.strictEqual(healthRes.status, 200);
    assert.strictEqual(healthJson.status, 'online');
    console.log('     ✓ Health check passed');

    // 2. Failed login test
    console.log('  2. Testing POST /api/auth/login with invalid credentials');
    const failLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'marcus.v@stocksense.io', password: 'wrongpassword' })
    });
    assert.strictEqual(failLoginRes.status, 401);
    const failLoginJson = await failLoginRes.json();
    assert.strictEqual(failLoginJson.success, false);
    console.log('     ✓ Rejected invalid password correctly');

    // 3. Successful login test
    console.log('  3. Testing POST /api/auth/login with valid seed credentials');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'marcus.v@stocksense.io', password: 'password123' })
    });
    assert.strictEqual(loginRes.status, 200);
    const loginJson = await loginRes.json();
    assert.strictEqual(loginJson.success, true);
    assert.ok(loginJson.token, 'Token should be returned');
    assert.strictEqual(loginJson.user.email, 'marcus.v@stocksense.io');
    assert.strictEqual(loginJson.user.role, 'manager');
    authToken = loginJson.token;
    testUserId = loginJson.user.id;
    console.log('     ✓ Logged in and received JWT token successfully');

    // 4. Session profile check GET /api/auth/me
    console.log('  4. Testing GET /api/auth/me (Protected Route)');
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });
    assert.strictEqual(meRes.status, 200);
    const meJson = await meRes.json();
    assert.strictEqual(meJson.user.id, testUserId);
    console.log('     ✓ Authenticated route verified token correctly');

    // 5. User Signup test
    const newEmail = `tester_${Date.now()}@stocksense.io`;
    console.log(`  5. Testing POST /api/auth/signup (${newEmail})`);
    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Logistics Lead',
        email: newEmail,
        password: 'securePassword99!',
        role: 'manager'
      })
    });
    assert.strictEqual(signupRes.status, 201);
    const signupJson = await signupRes.json();
    assert.strictEqual(signupJson.success, true);
    assert.strictEqual(signupJson.user.email, newEmail);
    console.log('     ✓ User registered and auto-signed JWT');

    // 6. Forgot Password: Step 1 (Send OTP)
    console.log('  6. Testing POST /api/auth/forgot-password/send-otp');
    const sendOtpRes = await fetch(`${baseUrl}/api/auth/forgot-password/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail })
    });
    assert.strictEqual(sendOtpRes.status, 200);
    const sendOtpJson = await sendOtpRes.json();
    assert.ok(sendOtpJson.debugOtp, 'Debug OTP should be available in dev');
    const otpCode = sendOtpJson.debugOtp;
    console.log(`     ✓ OTP code generated: ${otpCode}`);

    // 7. Forgot Password: Step 2 (Verify OTP)
    console.log('  7. Testing POST /api/auth/forgot-password/verify-otp');
    const verifyOtpRes = await fetch(`${baseUrl}/api/auth/forgot-password/verify-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, otpCode })
    });
    assert.strictEqual(verifyOtpRes.status, 200);
    const verifyOtpJson = await verifyOtpRes.json();
    assert.ok(verifyOtpJson.resetToken, 'Reset token should be returned');
    const resetToken = verifyOtpJson.resetToken;
    console.log('     ✓ OTP validated and reset token issued');

    // 8. Forgot Password: Step 3 (Reset Password)
    console.log('  8. Testing POST /api/auth/forgot-password/reset-password');
    const resetRes = await fetch(`${baseUrl}/api/auth/forgot-password/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newEmail,
        resetToken,
        newPassword: 'brandNewPassword2026!'
      })
    });
    assert.strictEqual(resetRes.status, 200);
    console.log('     ✓ Password reset confirmed');

    // 9. Verify login with newly reset password
    console.log('  9. Testing Login with newly reset password');
    const reLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, password: 'brandNewPassword2026!' })
    });
    assert.strictEqual(reLoginRes.status, 200);
    console.log('     ✓ Logged in with new password');

    // 10. Dashboard statistics test
    console.log('  10. Testing GET /api/dashboard/stats');
    const statsRes = await fetch(`${baseUrl}/api/dashboard/stats`);
    assert.strictEqual(statsRes.status, 200);
    const statsJson = await statsRes.json();
    assert.ok(statsJson.data.receipts.totalOperations > 0);
    assert.ok(statsJson.data.deliveries.totalOperations > 0);
    console.log(`     ✓ Dashboard stats returned: ${statsJson.data.receipts.toReceive} receipts pending`);

    // 11. Receipts operations list
    console.log('  11. Testing GET /api/operations/receipts');
    const receiptsRes = await fetch(`${baseUrl}/api/operations/receipts`);
    assert.strictEqual(receiptsRes.status, 200);
    const receiptsJson = await receiptsRes.json();
    assert.ok(receiptsJson.count >= 6);
    const targetReceipt = receiptsJson.data[0];
    console.log(`     ✓ Found ${receiptsJson.count} receipts`);

    // 12. Create Receipt
    console.log('  12. Testing POST /api/operations/receipts (Protected)');
    const createReceiptRes = await fetch(`${baseUrl}/api/operations/receipts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        vendor_from: 'Apex Heavy Logistics',
        destination_to: 'WH/Stock',
        contact: 'Apex Support',
        source_document: 'PO00099',
        status: 'ready',
        items: [{ product_name: 'Hydraulic Pallet Jack', sku: 'EQP-009', quantity: 2 }]
      })
    });
    assert.strictEqual(createReceiptRes.status, 201);
    const createdReceiptJson = await createReceiptRes.json();
    assert.strictEqual(createdReceiptJson.data.vendor_from, 'Apex Heavy Logistics');
    console.log(`     ✓ Receipt created with reference: ${createdReceiptJson.data.reference}`);

    // 13. Update Receipt Status
    console.log(`  13. Testing PATCH /api/operations/receipts/${targetReceipt.id}/status`);
    const updateRes = await fetch(`${baseUrl}/api/operations/receipts/${targetReceipt.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ status: 'done' })
    });
    assert.strictEqual(updateRes.status, 200);
    const updateJson = await updateRes.json();
    assert.strictEqual(updateJson.data.status, 'done');
    console.log('     ✓ Status updated to "done" successfully');

    // 14. Deliveries operations list
    console.log('  14. Testing GET /api/operations/deliveries');
    const deliveriesRes = await fetch(`${baseUrl}/api/operations/deliveries`);
    assert.strictEqual(deliveriesRes.status, 200);
    const deliveriesJson = await deliveriesRes.json();
    assert.ok(deliveriesJson.count >= 3);
    const targetDelivery = deliveriesJson.data[0];
    console.log(`     ✓ Found ${deliveriesJson.count} deliveries`);

    // 15. Create Delivery Order
    console.log('  15. Testing POST /api/operations/deliveries (Protected)');
    const createDeliveryRes = await fetch(`${baseUrl}/api/operations/deliveries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        vendor_from: 'WH/Stock',
        destination_to: 'Global Enterprises Inc',
        contact: 'Marcus Brody',
        source_document: 'SO0099',
        status: 'ready',
        items: [{ product_name: 'Standing Desk Frame', sku: 'FUR-002', quantity: 5 }]
      })
    });
    assert.strictEqual(createDeliveryRes.status, 201);
    const createdDeliveryJson = await createDeliveryRes.json();
    assert.strictEqual(createdDeliveryJson.data.destination_to, 'Global Enterprises Inc');
    assert.strictEqual(createdDeliveryJson.data.type, 'delivery');
    console.log(`     ✓ Delivery created with reference: ${createdDeliveryJson.data.reference}`);

    // 16. Update Delivery Status
    console.log(`  16. Testing PATCH /api/operations/deliveries/${targetDelivery.id}/status`);
    const updateDeliveryRes = await fetch(`${baseUrl}/api/operations/deliveries/${targetDelivery.id}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ status: 'done' })
    });
    assert.strictEqual(updateDeliveryRes.status, 200);
    const updateDeliveryJson = await updateDeliveryRes.json();
    assert.strictEqual(updateDeliveryJson.data.status, 'done');
    console.log('     ✓ Delivery status updated to "done" successfully');

    // 17. Unified operations query
    console.log('  17. Testing GET /api/operations?type=all');
    const allOpsRes = await fetch(`${baseUrl}/api/operations`);
    assert.strictEqual(allOpsRes.status, 200);
    const allOpsJson = await allOpsRes.json();
    assert.ok(allOpsJson.count >= 10);
    console.log(`     ✓ Total warehouse operations queried: ${allOpsJson.count}`);

    // 18. Unauthenticated Create Receipt
    console.log('  18. Testing POST /api/operations/receipts (Unauthenticated / Public)');
    const unauthRecRes = await fetch(`${baseUrl}/api/operations/receipts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendor_from: 'Direct Factory Supplier',
        destination_to: 'WH/Stock1',
        scheduled_date: '2026-09-30',
        items: [{ product_name: 'Steel Bolts Pack', sku: 'BOLT-01', quantity: 100 }]
      })
    });
    assert.strictEqual(unauthRecRes.status, 201);
    const unauthRecJson = await unauthRecRes.json();
    assert.ok(unauthRecJson.data.reference.startsWith('WH/IN/'));
    const unauthRecId = unauthRecJson.data.id;
    console.log(`     ✓ Unauthenticated receipt created: ${unauthRecJson.data.reference}`);

    // 19. Unauthenticated Create Delivery
    console.log('  19. Testing POST /api/operations/deliveries (Unauthenticated / Public)');
    const unauthDelRes = await fetch(`${baseUrl}/api/operations/deliveries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        destination_to: 'Express Client Logistics',
        scheduled_date: '2026-09-30',
        items: [{ product_name: 'Steel Bolts Pack', sku: 'BOLT-01', quantity: 20 }]
      })
    });
    assert.strictEqual(unauthDelRes.status, 201);
    const unauthDelJson = await unauthDelRes.json();
    assert.ok(unauthDelJson.data.reference.startsWith('WH/OUT/'));
    console.log(`     ✓ Unauthenticated delivery created: ${unauthDelJson.data.reference}`);

    // 20. Single operation retrieval with items
    console.log(`  20. Testing GET /api/operations/${unauthRecId}`);
    const getOpRes = await fetch(`${baseUrl}/api/operations/${unauthRecId}`);
    assert.strictEqual(getOpRes.status, 200);
    const getOpJson = await getOpRes.json();
    assert.strictEqual(getOpJson.data.id, unauthRecId);
    assert.ok(Array.isArray(getOpJson.data.items));
    assert.strictEqual(getOpJson.data.items[0].sku, 'BOLT-01');
    console.log(`     ✓ Operation retrieved with ${getOpJson.data.items.length} line items`);

    // 21. Update operation details (PUT)
    console.log(`  21. Testing PUT /api/operations/${unauthRecId}`);
    const updateOpRes = await fetch(`${baseUrl}/api/operations/${unauthRecId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendor_from: 'Direct Factory Supplier Updated',
        contact: 'Senior Dispatcher',
        items: [{ product_name: 'Steel Bolts Pack HD', sku: 'BOLT-01-HD', quantity: 150 }]
      })
    });
    assert.strictEqual(updateOpRes.status, 200);
    const updateOpJson = await updateOpRes.json();
    assert.strictEqual(updateOpJson.data.vendor_from, 'Direct Factory Supplier Updated');
    assert.strictEqual(updateOpJson.data.items[0].sku, 'BOLT-01-HD');
    console.log('     ✓ Operation updated successfully');

    // 22. Stock Inventory API
    console.log('  22. Testing GET /api/stock');
    const stockRes = await fetch(`${baseUrl}/api/stock`);
    assert.strictEqual(stockRes.status, 200);
    const stockJson = await stockRes.json();
    assert.ok(stockJson.count > 0);
    assert.ok(stockJson.data.some(s => s.sku === 'FUR-001'));
    console.log(`     ✓ Stock returned ${stockJson.count} tracked products`);

    // 23. Move History API
    console.log('  23. Testing GET /api/move-history');
    const historyRes = await fetch(`${baseUrl}/api/move-history`);
    assert.strictEqual(historyRes.status, 200);
    const historyJson = await historyRes.json();
    assert.ok(historyJson.count > 0);
    console.log(`     ✓ Move history returned ${historyJson.count} logged movement records`);

    // 24. Delete Operation
    console.log(`  24. Testing DELETE /api/operations/${unauthRecId}`);
    const deleteRes = await fetch(`${baseUrl}/api/operations/${unauthRecId}`, {
      method: 'DELETE'
    });
    assert.strictEqual(deleteRes.status, 200);
    const deleteJson = await deleteRes.json();
    assert.strictEqual(deleteJson.success, true);
    console.log('     ✓ Operation deleted successfully');

    console.log('\n🎉 ALL 24 TEST SUITE CHECKS (RECEIPTS + DELIVERIES + STOCK + HISTORY + AUTH) PASSED SUCCESSFULLY!\n');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
