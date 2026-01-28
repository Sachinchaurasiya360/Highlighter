const express = require('express');
const cors = require('cors');
const { nanoid } = require('nanoid');
const mongoose = require('mongoose');

const app = express();
const PORT = process.env.PORT || 3000;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://sachinchaurasiya69:606280Sk@tesing.8vhz1.mongodb.net/highlighter';

// MongoDB Connection
mongoose.connect(MONGODB_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define Schema
const highlightSchema = new mongoose.Schema({
  shareId: { type: String, required: true, unique: true },
  url: { type: String, required: true },
  highlights: { type: Array, required: true },
  createdAt: { type: Date, default: Date.now, expires: '30d' } // Auto-delete after 30 days
});

const Highlight = mongoose.model('Highlight', highlightSchema);

// Middleware
app.use(cors());
app.use(express.json());

/**
 * POST /api/highlights
 * Stores highlights in MongoDB and returns a unique ID
 */
app.post('/api/highlights', async (req, res) => {
  const { url, highlights } = req.body;
  
  if (!url || !highlights) {
    return res.status(400).json({ error: 'Missing url or highlights' });
  }

  try {
    const id = nanoid(10);
    const newHighlight = new Highlight({ shareId: id, url, highlights });
    await newHighlight.save();

    console.log(`Stored highlights in MongoDB for ${url} with ID: ${id}`);
    res.json({ id });
  } catch (error) {
    console.error('Error saving to MongoDB:', error);
    res.status(500).json({ error: 'Failed to save highlights' });
  }
});

/**
 * GET /api/highlights/:id
 * Retrieves highlights from MongoDB by shareId
 */
app.get('/api/highlights/:id', async (req, res) => {
  try {
    const data = await Highlight.findOne({ shareId: req.params.id });
    
    if (!data) {
      return res.status(404).json({ error: 'Highlights not found' });
    }

    res.json({
      url: data.url,
      highlights: data.highlights
    });
  } catch (error) {
    console.error('Error fetching from MongoDB:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * GET /h/:id
 * Redirects custom short links to the original URL with the highlight ID
 */
app.get('/h/:id', async (req, res) => {
  try {
    const data = await Highlight.findOne({ shareId: req.params.id });
    
    if (!data) {
      return res.status(404).send('Share link not found');
    }

    const originalUrl = new URL(data.url);
    originalUrl.searchParams.set('h_share', req.params.id);
    
    res.redirect(originalUrl.toString());
  } catch (error) {
    console.error('Error in redirect:', error);
    res.status(500).send('Internal server error');
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running at http://localhost:${PORT}`);
  console.log(`Share links will be formatted as: http://localhost:${PORT}/h/ID`);
});
