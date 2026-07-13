# Ganesh Trades Deployment Checklist

Follow these steps to deploy Ganesh Trades to production using Render and MongoDB Atlas.

## 1. Prepare MongoDB Atlas
1. Create a free account at [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a new Cluster (the free tier `M0` is sufficient).
3. Under **Database Access**, create a new database user and save the password.
4. Under **Network Access**, allow access from anywhere by adding IP `0.0.0.0/0`.
5. Under **Databases**, click "Connect" -> "Drivers" -> "Node.js" and copy the **Connection String**.
   * *It should look like:* `mongodb+srv://<username>:<password>@cluster0...mongodb.net/ganesh-trades?retryWrites=true&w=majority`

## 2. Deploy to Render
1. Create a free account at [Render](https://render.com/).
2. Push your `ganesh-trades` folder to a new GitHub repository.
3. In Render, go to **Dashboard** -> **New** -> **Web Service**.
4. Connect your GitHub repository.
5. Render will automatically detect the `render.yaml` file and configure the service as "Infrastructure as Code" (Blueprint).
6. **Important**: Since `MONGODB_URI` and `JWT_SECRET` are not synced in `render.yaml` for security, you must provide them manually.

## 3. Set Environment Variables
Go to the Render Dashboard for your new Web Service -> **Environment** and add the following variables:

| Key | Value | Description |
| :--- | :--- | :--- |
| `NODE_ENV` | `production` | Enables production optimizations. |
| `PORT` | `5000` | Render will automatically bind to this port. |
| `FRONTEND_URL` | `https://ganeshtrades.onrender.com` | Your app's public URL. |
| `MONGODB_URI` | `mongodb+srv://...` | The connection string from MongoDB Atlas. |
| `JWT_SECRET` | `(your secure secret)` | Generate a random string of at least 32 characters. |

## 4. Final Verification
- [ ] Wait for the build process to finish on Render.
- [ ] Go to `https://ganeshtrades.onrender.com`.
- [ ] Test that the frontend loads correctly.
- [ ] Try logging in (verifies API connection).
- [ ] Refresh the page on a route like `/dashboard` (verifies React Router fallback).

## Security Measures Configured
- **Helmet**: Sets various HTTP headers for security (adjusted for same-origin).
- **Express Rate Limit**: Prevents DDoS attacks and brute-forcing.
- **Compression**: Compresses responses for faster loading.
- **Environment Validation**: Ensures `JWT_SECRET` is strong enough in production mode.
- **CORS**: Configured to safely accept same-origin requests dynamically.
