const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Email setup
const transporter = nodemailer.createTransport({
  host: 'smtp.titan.email',
  port: 465,
  secure: true,
  auth: {
    user: process.env.LEAD_EMAIL_USER,
    pass: process.env.LEAD_EMAIL_PASS,
  }
});

<<<<<<< HEAD
// Handle lead form submission
app.post('/lead-details', (req, res) => {
  const { size, priority, timeline } = req.body;

  // Read existing contact details (from earlier /message POST)
  const contactInfoPath = path.join(__dirname, 'lead-contact.json');
  let contactInfo = { name: '', email: '', phone: '' };
  if (fs.existsSync(contactInfoPath)) {
    contactInfo = JSON.parse(fs.readFileSync(contactInfoPath));
  }
=======
// Parse contact details from a string message
function extractLeadDetails(message) {
  const emailMatch = message.match(/[\w.-]+@[\w.-]+\.[A-Za-z]{2,}/);
  const phoneMatch = message.match(/\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  const nameMatch = message
    .replace(emailMatch?.[0] || "", "")
    .replace(phoneMatch?.[0] || "", "")
    .replace(/[,\s]+/g, " ")
    .trim();
>>>>>>> parent of bf9c450 (Add context-aware product interest to Solomon lead capture)

  const emailBody = `
📥 New Garage Design Lead

Name: ${contactInfo.name}
Email: ${contactInfo.email}
Phone: ${contactInfo.phone}

Garage Size: ${size || 'N/A'}
Top Priority: ${priority || 'N/A'}
Timeline: ${timeline || 'N/A'}
  `;

  const mailOptions = {
    from: process.env.LEAD_EMAIL_USER,
    to: 'nick@elevatedgarage.com',
    subject: '📥 New Garage Design Lead',
    text: emailBody
  };

<<<<<<< HEAD
  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.error("❌ Email failed to send:", error);
      res.status(500).send("Error sending email");
    } else {
      console.log("✅ Garage lead email sent:", info.response);
      res.status(200).send("Lead captured");
    }
  });
});

// TEMP store contact info via POST (for testing)
app.post('/store-contact', (req, res) => {
  const { name, email, phone } = req.body;
  fs.writeFileSync(path.join(__dirname, 'lead-contact.json'), JSON.stringify({ name, email, phone }));
  res.sendStatus(200);
});

// Default page
=======
// Chat and lead capture logic
app.post('/message', async (req, res) => {
  const { message } = req.body;

  try {
    const chatCompletion = await openai.chat.completions.create({
      model: 'gpt-4',
      messages: [
        {
          role: "system",
          content: `
You are Solomon, a friendly and professional garage design assistant for Elevated Garage. Your role is to educate and assist users on remodeling projects.

If the user expresses interest in scheduling, a consultation, or getting started, respond like a human assistant would: ask for their name, email, and phone number. Never give exact prices or timelines — always say these vary by project complexity and product availability.

Once contact details are collected, thank them and let them know a team member will follow up.
`.trim()
        },
        { role: "user", content: message },
      ],
    });

    const reply = chatCompletion?.choices?.[0]?.message?.content || "I'm here to help whenever you're ready.";
    console.log(`Message from Visitor: "${message}"`);

    const { name, email, phone } = extractLeadDetails(message);
    console.log("🔍 Parsed Contact Details:");
    console.log("   Name:", name);
    console.log("   Email:", email);
    console.log("   Phone:", phone);

    if (name && email && phone) {
      const mailOptions = {
        from: process.env.LEAD_EMAIL_USER,
        to: 'nick@elevatedgarage.com',
        subject: '📥 New Solomon Lead',
        text: `
New Lead Captured:

Name: ${name}
Email: ${email}
Phone: ${phone}
Message: ${message}
        `.trim()
      };

      console.log("📤 Attempting to send email via Titan SMTP...");
      transporter.sendMail(mailOptions, (error, info) => {
        if (error) {
          console.error("❌ Email failed to send:", error);
        } else {
          console.log("✅ Lead email sent successfully:", info.response);
        }
      });
    }

    res.json({ reply });

  } catch (error) {
    console.error("OpenAI Error:");
    if (error.response) {
      console.error("Status:", error.response.status);
      console.error("Data:", JSON.stringify(error.response.data, null, 2));
    } else {
      console.error("Message:", error.message);
    }
    res.status(500).json({ error: "Error contacting OpenAI" });
  }
});

// Serve frontend
>>>>>>> parent of bf9c450 (Add context-aware product interest to Solomon lead capture)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Solomon backend running on port ${PORT}`);
});
