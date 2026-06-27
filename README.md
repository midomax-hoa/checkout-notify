# Zalo Payment Notify Test API

A minimal Node.js server built with [Hono](https://hono.dev) and TypeScript to test and log Zalo Pay webhook callback notifications (`handleZaloPaymentNotify`).

## Features
- Webhook signature verification mimicking `midomaxZNS-system` logic.
- Automated normalizations matching production handler.
- Detailed colored console log outputs for webhook inspection.
- `/payment/mock-sign` endpoint to easily generate signed request bodies.
- Docker & Docker Compose setup ready for local testing and Dokloy deployment.

---

## Environment Configuration

Configure the environment variables in a `.env` file at the root of the project folder:

```ini
PORT=3000
ZALO_MINIAPP_CHECKOUT_PRIVATE_KEY=mock_private_key_123456
```

---

## Getting Started

### Local Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Run in development mode:
   ```bash
   npm run dev
   ```

### Docker Setup
1. Build and run using Docker Compose:
   ```bash
   docker compose up --build
   ```

---

## API Endpoints

### 1. Root Check
* **GET** `/`
* Returns basic server status.

### 2. Sign Payload Mock (Helper)
Use this endpoint to sign any payload using the configured private key.
* **POST** `/payment/mock-sign`
* **Body (JSON)**:
  ```json
  {
    "appId": "123456",
    "orderId": "ORD_ZALO_9999",
    "method": "BANK"
  }
  ```
* **Response (JSON)**:
  ```json
  {
    "data": {
      "appId": "123456",
      "orderId": "ORD_ZALO_9999",
      "method": "BANK"
    },
    "mac": "a576c5b058bd2870420790899f896b0eeea30e703901b0b4b2efc8f3950fb2bf"
  }
  ```

### 3. Handle Webhook Notification
* **POST** `/payment/notify`
* **Body (JSON)**: Copy the response from the `/payment/mock-sign` endpoint:
  ```json
  {
    "data": {
      "appId": "123456",
      "orderId": "ORD_ZALO_9999",
      "method": "BANK"
    },
    "mac": "a576c5b058bd2870420790899f896b0eeea30e703901b0b4b2efc8f3950fb2bf"
  }
  ```
* **Response (JSON)**:
  - If signature matches:
    ```json
    {
      "returnCode": 1,
      "returnMessage": "success"
    }
    ```
  - If signature mismatches or is invalid:
    ```json
    {
      "returnCode": -1,
      "returnMessage": "Invalid mac"
    }
    ```
