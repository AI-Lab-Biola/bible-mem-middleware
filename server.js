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
  const originalText = req.body.originalText;

  console.log('Starting transcription process...');
  console.log('Original text:', originalText);

  try {
    // Convert audio to MP3
    console.log('Converting audio to MP3...');
    await new Promise((resolve, reject) => {
      ffmpeg(inputPath)
        .toFormat('mp3')
        .on('error', (err) => {
          console.error('FFmpeg error:', err);
          reject(err);
        })
        .on('end', () => {
          console.log('FFmpeg conversion complete');
          resolve();
        })
        .save(outputPath);
    });

    // Transcribe audio
    console.log('Transcribing audio...');
    const file = fs.createReadStream(outputPath);
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
    });
    console.log('Transcription received:', transcription.text);

    // Compare texts
    console.log('Comparing texts...');
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are a strict text comparison assistant. Before comparing texts, you MUST:

          1. FIRST, remove ALL of these elements from both texts:
             - ALL punctuation (periods, commas, semicolons, etc.)
             - ALL filler words: "umm", "hmm", "uh", "ah", "er", "like", "ahh", "uhh", "um", "eh"
             - ALL extra spaces or whitespace
             - Convert ALL text to lowercase

          2. THEN, compare the cleaned texts word by word.

          3. ONLY count these as errors:
             - Words present in transcribed text that don't exist in original text (EXCEPT filler words listed above)
             - Words missing from transcribed text that exist in original text
             - Words that differ from the original text
             - Words in wrong order

          Format response as JSON:
          {
            "errorCount": number,
            "comparisonResult": "HTML string with differences marked using <span class='error'>wrong word</span>",
            "accuracy": "percentage as string",
            "errors": [
              {
                "incorrect": "the incorrect or extra word",
                "correct": "the expected word or [missing]"
              }
            ]
          }

          Examples:
          Original: "For God so loved the world."
          Transcribed: "Umm... ahh... for God so loved, the world!"
          CORRECT RESULT: 0 errors (after removing filler words and punctuation)

          Original: "For God so loved the world"
          Transcribed: "Umm for God so loved earth ahh"
          CORRECT RESULT: 1 error (only "world" vs "earth" counts as an error, "umm" and "ahh" are ignored)`
        },
        {
          role: "user",
          content: `Compare these texts following the rules above:
          Original: "${originalText}"
          Transcribed: "${transcription.text}"`
        }
      ]
    });

    console.log('Raw GPT response:', completion.choices[0].message.content);

    // Parse the GPT-4 response
    let analysis;
    try {
      analysis = JSON.parse(completion.choices[0].message.content);
      console.log('Parsed analysis:', analysis);
    } catch (parseError) {
      console.error('Error parsing GPT response:', parseError);
      throw new Error('Failed to parse comparison analysis');
    }

    // Clean up files
    fs.unlinkSync(inputPath);
    fs.unlinkSync(outputPath);

    // Send response
    const response = {
      transcription: transcription.text,
      analysis: analysis
    };
    console.log('Sending response:', response);
    res.json(response);

  } catch (error) {
    console.error('Server Error:', error);
    // Clean up files if they exist
    try {
      if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
    } catch (cleanupError) {
      console.error('Error during cleanup:', cleanupError);
    }

    res.status(500).json({ 
      error: 'An error occurred during processing',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
