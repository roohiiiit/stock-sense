# StockSense — Inventory Management System

StockSense is an easy-to-use web application that helps businesses manage and track their warehouse inventory in real time. It replaces manual paper registers and Excel sheets with a simple digital system.

---

## 🎯 What Does StockSense Do?

StockSense tracks your products from the moment they arrive at your warehouse to when they are shipped to customers:

* **For Inventory Managers**: Monitor overall stock levels, track pending orders, and prevent stock-outs.
* **For Warehouse Staff**: Receive goods, pick and pack customer shipments, move items between shelves, and perform stock counts.

---

## 🚀 How to Run the Project

Follow these simple steps to run StockSense on your computer:

### 1. Prerequisites
Make sure you have [Node.js](https://nodejs.org/) installed (version 18 or above).

### 2. Clone the Repository
Open your terminal and run:
```bash
git clone https://github.com/roohiiiit/stock-sense.git
cd stock-sense
```

### 3. Install Dependencies
```bash
npm install
```

### 4. Seed the Database
Populate the database with sample products, users, and orders:
```bash
npm run seed
```

### 5. Start the Application
```bash
npm start
```

### 6. Open in Your Browser
Visit:
```
http://localhost:3000
```

---

## 🔑 Demo Login Accounts

You can log in right away using either of these pre-created accounts:

| Role | Email | Password |
| :--- | :--- | :--- |
| **Inventory Manager** | `marcus.v@stocksense.io` | `Password123!` |
| **Warehouse Staff** | `operator@stocksense.io` | `Password123!` |

> **Strong Password Requirement**: All new passwords (during account signup or password reset) require at least 8 characters, including at least one uppercase letter (A-Z), one lowercase letter (a-z), one digit (0-9), and one special symbol (`!@#$%^&*` etc.).
>
> **OTP Password Reset**: 
> * **Public Reset**: Click *"Forgot Password"* on the login page to initiate a 3-step recovery flow with a 6-digit OTP (valid for 10 minutes).
> * **In-App Reset**: Click your profile avatar in the dashboard header and select *"Reset Password (OTP)"* to reset your password within an active session.
> * **Demo / Dev Mode Display**: In development mode, the sent verification code appears in a prominent on-screen banner with an **Autofill** button for instant testing, as well as logged in the server console.

---

## ✨ Main Features

### 1. Robust Authentication & OTP Password Security
* **Multi-Step OTP Password Reset**: Secure 6-digit one-time passcode verification with 10-minute expiry, rate-limiting, and single-use reset tokens.
* **On-Screen Demo OTP Banner**: Convenient on-screen code display with 1-click Autofill for effortless demo and development testing.
* **In-App & Public Reset Support**: Password reset available publicly via login recovery or in-app via the authenticated user profile dropdown.
* **Strong Password Policy**: Strict server-side and client-side password policy (minimum 8 characters, uppercase, lowercase, number, and special character) with live strength meters.

### 2. Low Stock Alerts & Inventory Health
* **Automated Low Stock Detection**: Automatically flags items when quantities drop to or below safety stock threshold ($\le 10$ units) or reach 0 (Out of Stock).
* **Live Alerts Notification Center**: Header notification bell with badge counters and instant drop-down summary of endangered stock.
* **Dashboard Health Panel**: Dedicated low stock preview cards with 1-click **Restock** shortcuts to immediately draft replenishment receipts.
* **Stock Ledger Filtering**: Quick toggle to filter and view only low/out-of-stock items.

### 3. Live Dashboard
* See total items in stock, low stock warnings, pending incoming shipments, and outgoing deliveries.
* Filter orders easily by status (`Draft`, `Ready`, `Done`) or search by product name/SKU.

### 3. Warehouse Operations
* **Receipts (Incoming Goods)**: Receive items from suppliers. When you validate a receipt, your stock increases automatically.
* **Delivery Orders (Outgoing Goods)**: Pick and pack items for customers. When you validate an order, stock decreases automatically.
* **Internal Transfers**: Move items between shelves or storage areas (e.g., from *Main Store* to *Production Floor*).
* **Stock Adjustments**: Fix discrepancies if physical counts don't match the system (e.g., damaged or missing items).

### 4. Move History (Stock Ledger)
* Every single inventory movement is logged with date, product, quantity, source, and destination for full transparency.

### 5. Warehouse Facility & Location Management
* **Warehouse Details**: Configure primary warehouse identity, short code prefix (e.g. `WH`), and physical facility location address for transport and carrier documentation.
* **Storage Locations & Zones**: Manage physical and internal storage areas (racks, shelves, receiving docks, and shipping staging bays) with real-time zone status.

---

## 🔄 Simple Example of How Stock Flows

Here is an everyday example of how StockSense works:

1. **Receive Goods from Supplier**: Receive 100 kg of steel $\rightarrow$ **Stock increases by +100**.
2. **Move to Production Rack**: Transfer steel from *Main Store* to *Production Rack* $\rightarrow$ **Stock stays at 100, but location is updated**.
3. **Deliver Finished Goods**: Ship 20 units to a customer $\rightarrow$ **Stock decreases by -20**.
4. **Adjust for Damaged Items**: Count reveals 3 kg damaged $\rightarrow$ **Stock adjusts by -3**.

All 4 steps are automatically recorded in the ledger!

---

## 🧪 Testing

To run the automated tests and verify that all features work properly:
```bash
npm test
```
