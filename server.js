const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const OpenAI = require('openai');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Email configuration
const transporter = nodemailer.createTransport({
  host: 'smtp.titan.email',
  port: 465,
  secure: true,
  auth: {
    user: process.env.LEAD_EMAIL_USER,
    pass: process.env.LEAD_EMAIL_PASS,
  }
});

const contactPath = path.join(__dirname, 'lead-contact.json');

app.post('/store-contact', (req, res) => {
  const { name, email, phone } = req.body;
  fs.writeFileSync(contactPath, JSON.stringify({ name, email, phone }));
  res.sendStatus(200);
});

app.post('/lead-details', (req, res) => {
  const { size, priority, timeline } = req.body;

  let contactInfo = { name: '', email: '', phone: '' };
  if (fs.existsSync(contactPath)) {
    contactInfo = JSON.parse(fs.readFileSync(contactPath));
  }

  const emailBody = `
📥 New Garage Design Lead

Name: ${contactInfo.name || 'N/A'}
Email: ${contactInfo.email || 'N/A'}
Phone: ${contactInfo.phone || 'N/A'}

Garage Size: ${size || 'N/A'}
Top Priority: ${priority || 'N/A'}
Timeline: ${timeline || 'N/A'}
  `.trim();

  const mailOptions = {
    from: process.env.LEAD_EMAIL_USER,
    to: 'nick@elevatedgarage.com',
    subject: '📥 New Garage Design Lead',
    text: emailBody,
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("❌ Email failed:", error);
      res.status(500).send("Error sending lead");
    } else {
      console.log("✅ Garage lead email sent:", info.response);
      res.sendStatus(200);
    }
  });
});

app.post('/message', async (req, res) => {
  const { message } = req.body;

  try {
    const chatResponse = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: "system",
          content: `
You are Solomon, an AI garage design assistant for Elevated Garage.
- Help users explore garage flooring, cabinetry, lighting, saunas, cold plunges, home gyms, and more.
- Never provide specific prices or timelines — instead, offer to set up a consultation.
- If a user expresses serious interest in a remodel or asks for a quote, ask for their name/email/phone and trigger a custom garage form.
Respond warmly and professionally.
          `.trim()
        },
        { role: "user", content: message }
      ]
    });

    const reply = chatResponse.choices[0].message.content;

    // Check if form should be shown based on keywords
    const lowerMsg = message.toLowerCase();
    const showForm = /quote|consult|schedule|estimate|start|get started|i'm ready|how much|upgrade|design/.test(lowerMsg);

    res.json({ reply, showForm });

  } catch (err) {
    console.error("OpenAI Error:", err.message);
    res.status(500).json({ reply: "Sorry, something went wrong." });
  }
});

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Solomon backend running on port ${PORT}`);
});
