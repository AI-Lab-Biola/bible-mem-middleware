const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Routes
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to the Express API!' });
});

// Example route with path parameter
app.get('/api/users/:id', (req, res) => {
  const userId = req.params.id;
  res.json({ message: `Fetching user with ID: ${userId}` });
});

// Example POST route
app.post('/api/users', (req, res) => {
  const { name, email } = req.body;
  res.json({ message: 'User created', user: { name, email } });
});

// Start the server
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
