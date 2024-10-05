require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require("openai");
const ffmpeg = require('fluent-ffmpeg');
const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');

ffmpeg.setFfmpegPath(ffmpegInstaller.path);

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(cors());
app.use(express.json());

// Configure OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No audio file uploaded' });
  }

  const inputPath = req.file.path;
  const outputPath = path.join(path.dirname(inputPath), `${path.basename(inputPath)}.mp3`);

  try {
    // Convert the uploaded file to MP3
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('mp3')
        .on('error', (err) => reject(err))
        .on('end', () => resolve())
        .save(outputPath);
    });

    // Read the converted file
    const file = fs.createReadStream(outputPath);

    // Send the file to OpenAI for transcription
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
    });

    // Delete the temporary files
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    res.json({ transcription: transcription.text });
  } catch (error) {
    console.error('Error during transcription:', error);
    res.status(500).json({ error: 'An error occurred during transcription' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
