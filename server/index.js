const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegStatic);
const app = express();
app.use(cors());

const clientDistPath = path.join(__dirname, '../client/dist');
app.use(express.static(clientDistPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'));
});

const helmet = require('helmet');

app.use(
  helmet.contentSecurityPolicy({
    useDefaults: false, // disable Helmet's default settings
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      // add any other directives as needed
    },
  })
);


const baseScaleOptions = [
  [0, 2, 4, 7, 9],         //Major pentatonic
  [0, 3, 5, 7, 10],        //Minor pentatonic
  [0, 2, 3, 5, 7, 8, 10],  //Natural minor
  [0, 2, 4, 5, 7, 9, 11],  //Major
  [0, 3, 5, 6, 7, 10],     //Blues (6-note scale)
  [0, 3, 5, 7, 10]         //Simplified blues/pentatonic
];

const SCALES = [];
for(let i = 0; i < 100; i++){
  //Pick 1 base option at random
  const base = baseScaleOptions[Math.floor(Math.random() * baseScaleOptions.length)];
  //Transpose by a random offset from 0 to 11 semitones
  const offset = Math.floor(Math.random() * 12);
  //Create a new scale by adding the offset to each interval
  const newScale = base.map(interval => interval + offset);
  SCALES.push(newScale);
}

let generatedFiles = [];

//Set up multer storage
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `img-${Date.now()}-${Math.round(Math.random() * 1E9)}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});
const upload = multer({ storage });

//Upload Route
app.post('/upload', upload.single('image'), async (req, res) => {
  try {
    const filePath = req.file.path;
    // Resize the image and extract raw pixel data
    const width = 100;
    const height = 100;
    const { data, info } = await sharp(filePath)
      .resize(width, height)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Generate audio PCM buffer from the image data
    const audioBuffer = generateAudioFromImage(data, info.width, info.height, info.channels);
    
    // Write raw PCM data to a temporary file in uploads
    const rawFile = path.join(uploadDir, `output-${Date.now()}.raw`);
    fs.writeFileSync(rawFile, audioBuffer);
    
    // Generate a unique mp3 filename in uploads
    const mp3FileName = `audio-${Date.now()}-${Math.round(Math.random() * 1E9)}.mp3`;
    const mp3File = path.join(uploadDir, mp3FileName);
    
    // Convert the raw PCM file to MP3 using ffmpeg
    ffmpeg(rawFile)
      .inputFormat('s16le')
      .audioFrequency(44100)
      .audioChannels(1)
      .audioCodec('libmp3lame')
      .format('mp3')
      .on('end', () => {
        // Remove the temporary raw file and the uploaded image
        fs.unlink(rawFile, err => { if (err) console.error("Error deleting raw file:", err); });
        fs.unlink(filePath, err => { if (err) console.error("Error deleting image file:", err); });
        // Respond with the MP3 file URL (relative to your server)
        res.json({ 
            success: true, 
            results: [{ originalImage: req.file.filename, mp3File: mp3FileName }] 
        });

      })
      .on('error', (err) => {
        console.error('Error during conversion:', err);
        res.status(500).send('Conversion error');
      })
      .save(mp3File);
  } catch (err) {
    console.error('Processing error:', err);
    res.status(500).send('Server error');
  }
});

//Cleanup Route
app.delete('/cleanup', (req, res) =>{
    try{
        for(const filePath of generatedFiles){
            if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
        }
        }
        generatedFiles = [];
        res.json({ success: true });
    }catch(error){
        console.error('Cleanup error:', error);
        res.status(500).send('Cleanup error');
    }
});

function generateAudioFromImage(pixelData, width, height, channels){
    const totalPixels = width * height;
  
    //Compute average brightness all pixels
    let totalBrightness = 0;

    for (let i = 0; i < totalPixels; i++){
        const base = i * channels;
        const r = pixelData[base] || 0;
        const g = channels > 1 ? pixelData[base + 1] : 0;
        const b = channels > 2 ? pixelData[base + 2] : 0;
        totalBrightness += (r + g + b) / 3;
    }
    const avgBrightness = totalBrightness / totalPixels;
  
    //Base frequency between 200Hz and 400Hz based on brightness
    const baseFreq = 200 + ((avgBrightness / 255) * 200);
  
    //Pick one scale at random
    const scaleIntervals = SCALES[Math.floor(Math.random() * SCALES.length)];
    const scale = scaleIntervals.map(interval => baseFreq * Math.pow(2, interval / 12));
  
    // Audio settings
    const sampleRate = 44100;
    const noteDurationSeconds = 0.1;
    const samplesPerNote = Math.floor(noteDurationSeconds * sampleRate);
    const totalSamples = totalPixels * samplesPerNote;
    const int16Array = new Int16Array(totalSamples);
    let sampleIndex = 0;
    
    //Map a pixel’s brightness to a note
    function pixelToNote(r, g, b){
        const brightness = (r + g + b) / 3;
        //Map brightness to an index within the scale
        const idx = Math.floor((brightness / 255) * scale.length);
        return scale[idx % scale.length];
    }
  
    //Generate a sine wave note for each pixel and concatenate them
    for(let i = 0; i < totalPixels; i++){
        const base = i * channels;
        const r = pixelData[base + 0] || 0;
        const g = channels > 1 ? pixelData[base + 1] : 0;
        const b = channels > 2 ? pixelData[base + 2] : 0;
        const a = channels === 4 ? pixelData[base + 3] : 255;
        const freq = pixelToNote(r, g, b);
        const volume = (a / 255) * 0.5;
        
        for(let s = 0; s < samplesPerNote; s++){
            const t = s / sampleRate;
            const sampleVal = Math.sin(2 * Math.PI * freq * t) * volume;
            int16Array[sampleIndex++] = sampleVal * 32767;
        }
    }
    return Buffer.from(int16Array.buffer);
}

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
