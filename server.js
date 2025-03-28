const express = require('express');
const fs = require('fs');
const path = require('path');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
require('dotenv').config();

const app = express();
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, 'public')));

// Titan Mail SMTP setup
const transporter = nodemailer.createTransport({
  host: 'smtp.titan.email',
  port: 465,
  secure: true,
  auth: {
    user: process.env.LEAD_EMAIL_USER,
    pass: process.env.LEAD_EMAIL_PASS,
  }
});

// Store contact details temporarily
app.post('/store-contact', (req, res) => {
  const { name, email, phone } = req.body;
  const contactInfo = { name, email, phone };
  fs.writeFileSync(path.join(__dirname, 'lead-contact.json'), JSON.stringify(contactInfo));
  res.sendStatus(200);
});

// Handle lead form submission (optional fields)
app.post('/lead-details', (req, res) => {
  const { size, priority, timeline } = req.body;

  let contactInfo = { name: '', email: '', phone: '' };
  const contactFile = path.join(__dirname, 'lead-contact.json');
  if (fs.existsSync(contactFile)) {
    contactInfo = JSON.parse(fs.readFileSync(contactFile));
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
    text: emailBody
  };

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

// Serve chatbot UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Solomon backend running on port ${PORT}`);
});
