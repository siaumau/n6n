const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000; // Use environment port or 3000

// Configure CORS
// Be specific in production for security!
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests from known frontend origins (e.g., local dev server, deployed Vercel URL)
    // In production, replace '*' with your actual frontend URL like 'https://n6n.vercel.app'
    const allowedOrigins = ['http://127.0.0.1:5500', 'http://localhost:5500', 'https://n6n.vercel.app'];
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
};

app.use(cors(corsOptions));

// Simple logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.originalUrl}`);
  next();
});

// Proxy endpoint
app.get('/proxy', async (req, res) => {
  const targetUrl = req.query.targetUrl;

  if (!targetUrl) {
    return res.status(400).send({ error: 'Missing targetUrl query parameter' });
  }

  try {
    // Basic URL validation (can be enhanced)
    const parsedUrl = new URL(targetUrl);

    // Make the request using axios
    // Pass through relevant headers if needed, but be careful about security
    // For simplicity, we are making a basic GET request here.
    // You might need to handle different methods (POST, PUT etc.) and request bodies.
    const response = await axios({
        method: 'get', // Default to GET, could be passed as a query param too
        url: targetUrl,
        responseType: 'stream', // Stream the response to handle large files / binary data
        validateStatus: status => true // Accept all status codes from target
    });

    // Pass back the status code from the target server
    res.status(response.status);

    // Pass back headers from the target server
    // Be selective about which headers you pass through for security
    // Example: Pass content-type
    if (response.headers['content-type']) {
        res.setHeader('Content-Type', response.headers['content-type']);
    }
    // You might want to pass other headers like Content-Disposition etc.

    // Pipe the response stream directly to the client
    response.data.pipe(res);

  } catch (error) {
    console.error("Proxy Error:", error.message);
    if (error.response) {
        // The request was made and the server responded with a status code
        // that falls out of the range of 2xx
        res.status(error.response.status).send({ error: `Target server responded with status: ${error.response.status}`, details: error.message });
    } else if (error.request) {
        // The request was made but no response was received
        res.status(502).send({ error: 'Bad Gateway: No response from target server', details: error.message });
    } else {
        // Something happened in setting up the request that triggered an Error
        res.status(500).send({ error: 'Internal Server Error during proxy request', details: error.message });
    }
  }
});

app.listen(port, () => {
  console.log(`Backend proxy server listening at http://localhost:${port}`);
});
