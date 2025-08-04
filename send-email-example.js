// Example code for sending email with Resend
// DO NOT commit this file with your API key!

const { Resend } = require('resend');

// Initialize Resend with your API key
const resend = new Resend('re_hDDW8vmQ_6QqDVThLXXcsV32TbtbF5ndh'); // Replace with your actual key

async function sendTestEmail() {
  try {
    const data = await resend.emails.send({
      from: 'onboarding@resend.dev', // Replace with your verified domain
      to: 'eimispacheco@gmail.com',
      subject: 'Test Email from Vibelytics',
      html: `
        <h1>Vibelytics Insights Report</h1>
        <p>This is a test email containing the insights from your YouTube comment analysis.</p>
        <h2>Key Insights:</h2>
        <ul>
          <li>Audience Sentiment Analysis</li>
          <li>Top 5 Influential Comments</li>
          <li>Video Creation Ideas</li>
          <li>Comment Topics</li>
          <li>Top Engaged Users</li>
          <li>Business Opportunities</li>
          <li>Frequently Asked Questions</li>
          <li>Best Features</li>
          <li>Areas for Improvement</li>
          <li>Most Interesting Comments</li>
          <li>Word Cloud Analysis</li>
        </ul>
        <p>Visit Vibelytics to see the full analysis!</p>
      `
    });

    console.log('Email sent successfully:', data);
  } catch (error) {
    console.error('Error sending email:', error);
  }
}

// Call the function to send the email
sendTestEmail();

// To run this file:
// 1. Install resend: npm install resend
// 2. Replace YOUR_API_KEY_HERE with your actual API key
// 3. Run: node send-email-example.js