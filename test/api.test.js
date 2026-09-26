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

    // 3. Successful login test with updated strong seed credentials
    console.log('  3. Testing POST /api/auth/login with valid seed credentials (Password123!)');
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'marcus.v@stocksense.io', password: 'Password123!' })
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

    // 5. Strong Password Validation: Signup Rejection Tests
    console.log('  5. Testing Strong Password Enforcement during Signup');
    const weakPasswords = [
      { pwd: 'short', reason: 'Too short' },
      { pwd: 'password123!', reason: 'Missing uppercase' },
      { pwd: 'PASSWORD123!', reason: 'Missing lowercase' },
      { pwd: 'Password!', reason: 'Missing numbers' },
      { pwd: 'Password123', reason: 'Missing special character' }
    ];

    for (const item of weakPasswords) {
      const rejectRes = await fetch(`${baseUrl}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Weak Pwd Tester',
          email: `weak_${Date.now()}_${Math.random().toString(36).substring(7)}@stocksense.io`,
          password: item.pwd,
          role: 'staff'
        })
      });
      assert.strictEqual(rejectRes.status, 400, `Expected 400 rejection for: ${item.reason}`);
      const rejectJson = await rejectRes.json();
      assert.strictEqual(rejectJson.success, false);
      assert.ok(rejectJson.message.toLowerCase().includes('password must'));
    }
    console.log('     ✓ Rejected all weak password combinations correctly');

    // 6. User Signup test with valid strong password and warehouse setup (2-step registration)
    const newEmail = `tester_${Date.now()}@stocksense.io`;
    const whSetupCode = `WH${Math.floor(100 + Math.random() * 899)}`;
    console.log(`  6. Testing POST /api/auth/signup with strong password & warehouse setup (${newEmail}, code: ${whSetupCode})`);
    const signupRes = await fetch(`${baseUrl}/api/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'New Logistics Lead',
        email: newEmail,
        password: 'securePassword99!',
        role: 'manager',
        warehouse: {
          name: 'Apex Central Hub',
          short_code: whSetupCode,
          address: '400 Industrial Blvd, Dock 8, Chicago, IL 60605'
        }
      })
    });
    assert.strictEqual(signupRes.status, 201);
    const signupJson = await signupRes.json();
    assert.strictEqual(signupJson.success, true);
    assert.strictEqual(signupJson.user.email, newEmail);
    assert.ok(signupJson.warehouse, 'Warehouse should be created during signup');
    assert.strictEqual(signupJson.warehouse.name, 'Apex Central Hub');
    assert.strictEqual(signupJson.warehouse.short_code, whSetupCode);
    assert.strictEqual(signupJson.warehouse.locations.length, 4, 'Should auto-generate 4 standard locations');
    const newEmailToken = signupJson.token;
    console.log('     ✓ User registered with warehouse and 4 auto-generated storage locations');

    // 7. Forgot Password: Step 1 (Send OTP)
    console.log('  7. Testing POST /api/auth/forgot-password/send-otp');
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

    // 8. Forgot Password: Step 2 (Verify OTP)
    console.log('  8. Testing POST /api/auth/forgot-password/verify-otp');
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

    // 9. Forgot Password: Reset Password with Weak Password (should be rejected)
    console.log('  9. Testing POST /api/auth/forgot-password/reset-password with weak password (rejected)');
    const weakResetRes = await fetch(`${baseUrl}/api/auth/forgot-password/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newEmail,
        resetToken,
        newPassword: 'weak'
      })
    });
    assert.strictEqual(weakResetRes.status, 400);
    console.log('     ✓ Rejected weak reset password correctly');

    // 10. Forgot Password: Step 3 (Reset Password with strong password)
    console.log('  10. Testing POST /api/auth/forgot-password/reset-password with strong password');
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

    // 11. Verify login with newly reset password
    console.log('  11. Testing Login with newly reset password');
    const reLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, password: 'brandNewPassword2026!' })
    });
    assert.strictEqual(reLoginRes.status, 200);
    console.log('     ✓ Logged in with new password');

    // 12. Dashboard statistics & Low Stock metrics test
    console.log('  12. Testing GET /api/dashboard/stats (including lowStock alerts)');
    const statsRes = await fetch(`${baseUrl}/api/dashboard/stats`);
    assert.strictEqual(statsRes.status, 200);
    const statsJson = await statsRes.json();
    assert.ok(statsJson.data.receipts.totalOperations > 0);
    assert.ok(statsJson.data.deliveries.totalOperations > 0);
    assert.ok(statsJson.data.lowStock, 'lowStock should be returned in stats');
    assert.ok(statsJson.data.lowStock.totalAlerts >= 0);
    assert.ok(Array.isArray(statsJson.data.lowStock.items));
    console.log(`     ✓ Dashboard stats returned: ${statsJson.data.receipts.toReceive} receipts pending, ${statsJson.data.lowStock.totalAlerts} low stock alerts`);

    // 13. Low Stock Alerts API test
    console.log('  13. Testing GET /api/stock/alerts');
    const alertsRes = await fetch(`${baseUrl}/api/stock/alerts?threshold=10`);
    assert.strictEqual(alertsRes.status, 200);
    const alertsJson = await alertsRes.json();
    assert.strictEqual(alertsJson.success, true);
    assert.strictEqual(alertsJson.threshold, 10);
    assert.ok(alertsJson.totalAlerts >= 0);
    assert.ok(Array.isArray(alertsJson.alerts));
    console.log(`     ✓ Low stock alerts API returned ${alertsJson.totalAlerts} active alerts (Critical: ${alertsJson.criticalCount}, Warning: ${alertsJson.warningCount})`);

    // 14. Receipts operations list
    console.log('  14. Testing GET /api/operations/receipts');
    const receiptsRes = await fetch(`${baseUrl}/api/operations/receipts`);
    assert.strictEqual(receiptsRes.status, 200);
    const receiptsJson = await receiptsRes.json();
    assert.ok(receiptsJson.count > 0);
    console.log(`     ✓ Found ${receiptsJson.count} receipts`);

    // 15. Create new receipt operation (Authenticated)
    console.log('  15. Testing POST /api/operations/receipts (Protected)');
    const createRecRes = await fetch(`${baseUrl}/api/operations/receipts`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        vendor_from: 'Steelworks International',
        destination_to: 'WH/Stock1',
        contact: 'Marcus Vance',
        source_document: 'PO-2026-0099',
        items: [
          { product_name: 'Heavy Duty Steel Beam', sku: 'STL-999', quantity: 40, unit: 'Units' }
        ]
      })
    });
    assert.strictEqual(createRecRes.status, 201);
    const createRecJson = await createRecRes.json();
    const createdReceiptId = createRecJson.data.id;
    assert.ok(createRecJson.data.reference.startsWith('WH/IN/'));
    console.log(`     ✓ Receipt created with reference: ${createRecJson.data.reference}`);

    // 16. Update status PATCH /api/operations/receipts/:id/status
    console.log(`  16. Testing PATCH /api/operations/receipts/${createdReceiptId}/status`);
    const patchRecRes = await fetch(`${baseUrl}/api/operations/receipts/${createdReceiptId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ status: 'done' })
    });
    assert.strictEqual(patchRecRes.status, 200);
    const patchRecJson = await patchRecRes.json();
    assert.strictEqual(patchRecJson.data.status, 'done');
    console.log('     ✓ Status updated to "done" successfully');

    // 17. Delivery operations list
    console.log('  17. Testing GET /api/operations/deliveries');
    const delivRes = await fetch(`${baseUrl}/api/operations/deliveries`);
    assert.strictEqual(delivRes.status, 200);
    const delivJson = await delivRes.json();
    assert.ok(delivJson.count > 0);
    console.log(`     ✓ Found ${delivJson.count} deliveries`);

    // 18. Create new delivery operation (Authenticated)
    console.log('  18. Testing POST /api/operations/deliveries (Protected)');
    const createDelRes = await fetch(`${baseUrl}/api/operations/deliveries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        destination_to: 'Apex Logistics Hub',
        vendor_from: 'WH/Stock1',
        contact: 'Dispatch Driver',
        source_document: 'SO-9921',
        items: [
          { product_name: 'Heavy Duty Steel Beam', sku: 'STL-999', quantity: 15, unit: 'Units' }
        ]
      })
    });
    assert.strictEqual(createDelRes.status, 201);
    const createDelJson = await createDelRes.json();
    const createdDelivId = createDelJson.data.id;
    assert.ok(createDelJson.data.reference.startsWith('WH/OUT/'));
    console.log(`     ✓ Delivery created with reference: ${createDelJson.data.reference}`);

    // 19. Update status of delivery
    console.log(`  19. Testing PATCH /api/operations/deliveries/${createdDelivId}/status`);
    const patchDelRes = await fetch(`${baseUrl}/api/operations/deliveries/${createdDelivId}/status`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({ status: 'done' })
    });
    assert.strictEqual(patchDelRes.status, 200);
    const patchDelJson = await patchDelRes.json();
    assert.strictEqual(patchDelJson.data.status, 'done');
    console.log('     ✓ Delivery status updated to "done" successfully');

    // 20. Public operations list
    console.log('  20. Testing GET /api/operations?type=all');
    const opsRes = await fetch(`${baseUrl}/api/operations?type=all`);
    assert.strictEqual(opsRes.status, 200);
    const opsJson = await opsRes.json();
    assert.ok(opsJson.count > 0);
    console.log(`     ✓ Total warehouse operations queried: ${opsJson.count}`);

    // 21. Unauthenticated receipt creation
    console.log('  21. Testing POST /api/operations/receipts (Unauthenticated / Public)');
    const unauthRecRes = await fetch(`${baseUrl}/api/operations/receipts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        vendor_from: 'Direct Factory Supplier',
        destination_to: 'WH/Stock1',
        contact: 'Warehouse Lead',
        source_document: 'PO-PUBLIC-101',
        items: [{ product_name: 'Steel Bolts Pack', sku: 'BOLT-01', quantity: 200, unit: 'Units' }]
      })
    });
    assert.strictEqual(unauthRecRes.status, 201);
    const unauthRecJson = await unauthRecRes.json();
    const unauthRecId = unauthRecJson.data.id;
    assert.ok(unauthRecJson.data.reference.startsWith('WH/IN/'));
    console.log(`     ✓ Unauthenticated receipt created: ${unauthRecJson.data.reference}`);

    // 22. Single operation retrieval with items
    console.log(`  22. Testing GET /api/operations/${unauthRecId}`);
    const getOpRes = await fetch(`${baseUrl}/api/operations/${unauthRecId}`);
    assert.strictEqual(getOpRes.status, 200);
    const getOpJson = await getOpRes.json();
    assert.strictEqual(getOpJson.data.id, unauthRecId);
    assert.ok(Array.isArray(getOpJson.data.items));
    assert.strictEqual(getOpJson.data.items[0].sku, 'BOLT-01');
    console.log(`     ✓ Operation retrieved with ${getOpJson.data.items.length} line items`);

    // 23. Update operation details (PUT)
    console.log(`  23. Testing PUT /api/operations/${unauthRecId}`);
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

    // 24. Stock Inventory API
    console.log('  24. Testing GET /api/stock');
    const stockRes = await fetch(`${baseUrl}/api/stock`);
    assert.strictEqual(stockRes.status, 200);
    const stockJson = await stockRes.json();
    assert.ok(stockJson.count > 0);
    assert.ok(stockJson.data.some(s => s.sku === 'FUR-001'));
    assert.ok(stockJson.lowStockCount !== undefined);
    console.log(`     ✓ Stock returned ${stockJson.count} tracked products (Low stock count: ${stockJson.lowStockCount})`);

    // 25. Move History API
    console.log('  25. Testing GET /api/move-history');
    const historyRes = await fetch(`${baseUrl}/api/move-history`);
    assert.strictEqual(historyRes.status, 200);
    const historyJson = await historyRes.json();
    assert.ok(historyJson.count > 0);
    console.log(`     ✓ Move history returned ${historyJson.count} logged movement records`);

    // 26. Delete Operation
    console.log(`  26. Testing DELETE /api/operations/${unauthRecId}`);
    const deleteRes = await fetch(`${baseUrl}/api/operations/${unauthRecId}`, {
      method: 'DELETE'
    });
    assert.strictEqual(deleteRes.status, 200);
    const deleteJson = await deleteRes.json();
    assert.strictEqual(deleteJson.success, true);
    console.log('     ✓ Operation deleted successfully');

    // 27. Authenticated Change Password Flow: Send OTP
    console.log('  27. Testing POST /api/auth/change-password/send-otp (Protected)');
    const authOtpRes = await fetch(`${baseUrl}/api/auth/change-password/send-otp`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newEmailToken}`
      }
    });
    assert.strictEqual(authOtpRes.status, 200);
    const authOtpJson = await authOtpRes.json();
    assert.strictEqual(authOtpJson.success, true);
    assert.ok(authOtpJson.debugOtp, 'Debug OTP should be returned for authenticated change');
    const authOtpCode = authOtpJson.debugOtp;
    console.log(`     ✓ Authenticated OTP generated for session: ${authOtpCode}`);

    // 28. Authenticated Change Password Flow: Verify and Update Password
    console.log('  28. Testing POST /api/auth/change-password/verify-and-update (validation + success)');
    // Test weak password rejection
    const weakAuthChangeRes = await fetch(`${baseUrl}/api/auth/change-password/verify-and-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newEmailToken}`
      },
      body: JSON.stringify({
        otpCode: authOtpCode,
        newPassword: 'weak'
      })
    });
    assert.strictEqual(weakAuthChangeRes.status, 400);

    // Test successful password update with strong password
    const successAuthChangeRes = await fetch(`${baseUrl}/api/auth/change-password/verify-and-update`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newEmailToken}`
      },
      body: JSON.stringify({
        otpCode: authOtpCode,
        newPassword: 'ChangedPassword2026!'
      })
    });
    assert.strictEqual(successAuthChangeRes.status, 200);
    const successAuthChangeJson = await successAuthChangeRes.json();
    assert.strictEqual(successAuthChangeJson.success, true);

    // Verify login with the updated password
    const verifyAuthLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: newEmail, password: 'ChangedPassword2026!' })
    });
    assert.strictEqual(verifyAuthLoginRes.status, 200);
    console.log('     ✓ In-app OTP password change verified with strong password enforcement');

    // 29. Warehouse Details: GET /api/warehouse
    console.log('  29. Testing GET /api/warehouse (Warehouse Details & Locations)');
    const whRes = await fetch(`${baseUrl}/api/warehouse`);
    assert.strictEqual(whRes.status, 200);
    const whJson = await whRes.json();
    assert.strictEqual(whJson.success, true);
    assert.ok(whJson.warehouse.id, 'Warehouse ID should be present');
    assert.strictEqual(whJson.warehouse.short_code, 'WH');
    assert.ok(Array.isArray(whJson.warehouse.locations), 'Locations array should be present');
    assert.ok(whJson.warehouse.locations.length >= 4, 'Should have at least 4 default locations');
    console.log(`     ✓ Warehouse details retrieved: "${whJson.warehouse.name}" (${whJson.warehouse.short_code}) with ${whJson.warehouse.locations.length} locations`);

    // 30. Warehouse Validation: Reject empty or invalid fields
    console.log('  30. Testing PUT /api/warehouse with invalid payload (rejection)');
    const whInvalidRes = await fetch(`${baseUrl}/api/warehouse`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', short_code: '', address: '' })
    });
    assert.strictEqual(whInvalidRes.status, 400);
    console.log('     ✓ Empty warehouse details correctly rejected');

    // 31. Warehouse Details: PUT /api/warehouse update
    console.log('  31. Testing PUT /api/warehouse update details');
    const whUpdateRes = await fetch(`${baseUrl}/api/warehouse`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Main Distribution Hub',
        short_code: 'WH',
        address: '500 Logistics Parkway, Suite B, Chicago, IL 60611'
      })
    });
    assert.strictEqual(whUpdateRes.status, 200);
    const whUpdateJson = await whUpdateRes.json();
    assert.strictEqual(whUpdateJson.warehouse.name, 'Main Distribution Hub');
    assert.strictEqual(whUpdateJson.warehouse.address, '500 Logistics Parkway, Suite B, Chicago, IL 60611');
    console.log('     ✓ Warehouse details updated successfully');

    // 32. Warehouse Locations: POST /api/warehouse/locations
    console.log('  32. Testing POST /api/warehouse/locations (Create new location)');
    const newLocRes = await fetch(`${baseUrl}/api/warehouse/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Cold Storage Room 3',
        code: 'WH/Cold3',
        type: 'internal'
      })
    });
    assert.strictEqual(newLocRes.status, 201);
    const newLocJson = await newLocRes.json();
    assert.strictEqual(newLocJson.success, true);
    assert.strictEqual(newLocJson.location.code, 'WH/Cold3');
    const createdLocId = newLocJson.location.id;
    console.log('     ✓ New location "WH/Cold3" created successfully');

    // Test duplicate location code rejection
    const dupLocRes = await fetch(`${baseUrl}/api/warehouse/locations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Another Cold Room',
        code: 'WH/Cold3',
        type: 'internal'
      })
    });
    assert.strictEqual(dupLocRes.status, 400);
    console.log('     ✓ Duplicate location code correctly rejected');

    // 33. Warehouse Locations: DELETE /api/warehouse/locations/:id
    console.log('  33. Testing DELETE /api/warehouse/locations/:id');
    const delLocRes = await fetch(`${baseUrl}/api/warehouse/locations/${createdLocId}`, {
      method: 'DELETE'
    });
    assert.strictEqual(delLocRes.status, 200);
    const delLocJson = await delLocRes.json();
    assert.strictEqual(delLocJson.success, true);
    console.log('     ✓ Location deleted successfully');

    // 34. User-linked Warehouse: GET and PUT /api/warehouse with User Session Token
    console.log('  34. Testing GET and PUT /api/warehouse with User Auth Token');
    const userWhRes = await fetch(`${baseUrl}/api/warehouse`, {
      headers: { Authorization: `Bearer ${newEmailToken}` }
    });
    assert.strictEqual(userWhRes.status, 200);
    const userWhJson = await userWhRes.json();
    assert.strictEqual(userWhJson.warehouse.name, 'Apex Central Hub');
    assert.strictEqual(userWhJson.warehouse.short_code, whSetupCode);
    assert.strictEqual(userWhJson.warehouse.locations.length, 4);

    // Update warehouse address using session token
    const userWhUpdateRes = await fetch(`${baseUrl}/api/warehouse`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${newEmailToken}`
      },
      body: JSON.stringify({
        name: 'Apex Central Hub (Updated)',
        short_code: whSetupCode,
        address: '400 Industrial Blvd, Dock 10, Chicago, IL 60605'
      })
    });
    assert.strictEqual(userWhUpdateRes.status, 200);
    const userWhUpdateJson = await userWhUpdateRes.json();
    assert.strictEqual(userWhUpdateJson.warehouse.name, 'Apex Central Hub (Updated)');
    assert.strictEqual(userWhUpdateJson.warehouse.address, '400 Industrial Blvd, Dock 10, Chicago, IL 60605');
    // 35. Stock Update: Invalid Payload Rejection
    console.log('  35. Testing PUT /api/stock/:sku with invalid payload (rejection)');
    const stockInvalidRes = await fetch(`${baseUrl}/api/stock/FUR-001`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        product_name: '',
        location: 'WH/Stock1',
        on_hand: -5
      })
    });
    assert.strictEqual(stockInvalidRes.status, 400);
    console.log('     ✓ Invalid stock payload correctly rejected');

    // 36. Stock Update: Valid Edit & Verification
    console.log('  36. Testing PUT /api/stock/:sku to edit product stock details');
    const stockUpdateRes = await fetch(`${baseUrl}/api/stock/FUR-001`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authToken}`
      },
      body: JSON.stringify({
        product_name: 'Office Chair Ergonomic Pro Max',
        category: 'Executive Furniture',
        location: 'WH/Stock2',
        on_hand: 42,
        min_threshold: 15,
        unit: 'Units'
      })
    });
    assert.strictEqual(stockUpdateRes.status, 200);
    const stockUpdateJson = await stockUpdateRes.json();
    assert.strictEqual(stockUpdateJson.success, true);
    assert.strictEqual(stockUpdateJson.data.product_name, 'Office Chair Ergonomic Pro Max');
    assert.strictEqual(stockUpdateJson.data.location, 'WH/Stock2');
    assert.strictEqual(stockUpdateJson.data.on_hand, 42);

    // Verify GET /api/stock reflects updated item
    const verifyStockRes = await fetch(`${baseUrl}/api/stock`);
    const verifyStockJson = await verifyStockRes.json();
    const updatedItem = verifyStockJson.data.find(s => s.sku === 'FUR-001');
    assert.strictEqual(updatedItem.product_name, 'Office Chair Ergonomic Pro Max');
    assert.strictEqual(updatedItem.on_hand, 42);
    assert.strictEqual(updatedItem.location, 'WH/Stock2');
    console.log('     ✓ Stock item edited and verified in inventory feed');

    console.log('\n🎉 ALL 36 TEST SUITE CHECKS (RECEIPTS + DELIVERIES + STOCK + LOW STOCK ALERTS + STRONG PASSWORDS + OTP + WAREHOUSE ONBOARDING & DETAILS + STOCK EDITING) PASSED SUCCESSFULLY!\n');
  } finally {
    server.close();
  }
}

runTests().catch(err => {
  console.error('\n❌ Test Suite Failed:', err);
  process.exit(1);
});
