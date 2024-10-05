require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Configuration, OpenAIApi } = require("openai");

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());

// Configure OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }

  try {
    const resp = await openai.createTranscription(
      fs.createReadStream(req.file.path),
      "whisper-1"
    );

    // Delete the temporary file
    fs.unlinkSync(req.file.path);

    res.json({ transcription: resp.data.text });
  } catch (error) {
    console.error('Error during transcription:', error);
    res.status(500).json({ error: 'An error occurred during transcription' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
