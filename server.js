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

// Handle lead form submission
app.post('/lead-details', (req, res) => {
  const { size, priority, timeline } = req.body;

  // Read existing contact details (from earlier /message POST)
  const contactInfoPath = path.join(__dirname, 'lead-contact.json');
  let contactInfo = { name: '', email: '', phone: '' };
  if (fs.existsSync(contactInfoPath)) {
    contactInfo = JSON.parse(fs.readFileSync(contactInfoPath));
  }

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
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Solomon backend running on port ${PORT}`);
});
