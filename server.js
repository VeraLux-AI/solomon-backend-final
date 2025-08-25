
const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const OpenAI = require('openai');
const { google } = require('googleapis');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const transporter = nodemailer.createTransport({
  host: 'smtp.titan.email',
  port: 465,
  secure: true,
  auth: {
    user: process.env.LEAD_EMAIL_USER,
    pass: process.env.LEAD_EMAIL_PASS,
  }
});

app.post('/message', async (req, res) => {
  const { message, source } = req.body;

  console.log("📨 Received message:", message);
  if (source) console.log("📍 Source:", source);

  const emailMatch = message.match(/[\w.-]+@[\w.-]+\.[A-Za-z]{2,}/);
  const phoneMatch = message.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const nameLikely = /([A-Z][a-z]+\s[A-Z][a-z]+)/.test(message);

  if (source === "contact" && emailMatch && phoneMatch && nameLikely) {
    const nameMatch = message.match(/([A-Z][a-z]+\s[A-Z][a-z]+)/);
    const name = nameMatch ? nameMatch[0] : "N/A";
    const email = emailMatch[0];
    const phone = phoneMatch[0];

    const mailOptions = {
      from: process.env.LEAD_EMAIL_USER,
      to: 'nick@elevatedgarage.com',
      subject: '📥 New Consultation Request',
      text: (
        "New Lead Captured:\n\n" +
        "Name: " + name + "\n" +
        "Email: " + email + "\n" +
        "Phone: " + phone + "\n" +
        "Original Message: " + message
      )
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.error("❌ Email failed to send:", error);
      } else {
        console.log("✅ Contact info sent via email:", info.response);
      }
    });

    return res.json({
      reply: "Thanks, I've submitted your information to our team! We'll reach out shortly to schedule your consultation."
    });
  }

  try {
    console.log("🧠 Sending to OpenAI:", message);

    const systemPrompt = "You are Solomon, the professional AI assistant for Elevated Garage.\n\n" +
    "✅ Answer garage-related questions about materials like flooring, cabinetry, lighting, and more.\n" +
    "✅ Only provide **average material costs** when discussing pricing.\n" +
    "✅ Clearly state: \"This is for material cost only.\"\n" +
    "✅ Include this disclaimer: \"This is not a quote — material prices may vary depending on brand, availability, and local suppliers.\"\n\n" +
    "🚫 Never include labor, install, or total pricing.\n" +
    "🚫 Never apply markup.\n\n" +
    "✅ If a user shows interest in starting a project, ask:\n" +
    "\"Would you like to schedule a consultation to explore your options further?\"\n\n" +
    "Only collect contact info if the user replies with name, email, and phone in one message.";

    const aiResponse = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message }
      ]
    });

    const reply = aiResponse.choices?.[0]?.message?.content || 
                  "✅ Solomon received your message but didn’t return a clear reply. Please try rephrasing.";

    res.json({ reply });

  } catch (err) {
    console.error("❌ OpenAI Error:", err.message);
    res.status(500).json({
      reply: "⚠️ Sorry, Solomon had trouble processing your request. Please try again shortly."
    });
  }
});

const oauth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

app.get('/auth', (req, res) => {
  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/drive.file'],
    redirect_uri: process.env.GOOGLE_REDIRECT_URI
  });
  res.redirect(authUrl);
});

app.get('/api/oauth2callback', async (req, res) => {
  const code = req.query.code;

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);
    fs.writeFileSync('token.json', JSON.stringify(tokens, null, 2));
    res.send("✅ Authorization successful! You may close this window.");
  } catch (err) {
    console.error('❌ Error retrieving access token:', err.message);
    res.status(500).send('Failed to authorize. Please try again.');
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Solomon backend running on port ${PORT}`);
});
