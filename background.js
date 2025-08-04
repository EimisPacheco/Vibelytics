// Background script to handle API calls
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'sendEmail') {
    console.log('Background: Received email request');
    
    // Send email using Resend API
    (async () => {
      try {
        const response = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': 'Bearer re_hDDW8vmQ_6QqDVThLXXcsV32TbtbF5ndh',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            from: 'Vibelytics <onboarding@resend.dev>',
            to: request.to,
            subject: request.subject,
            html: request.html
          })
        });

        const data = await response.json();
        console.log('Background: API Response:', data);
        
        if (response.ok && data.id) {
          console.log('Background: Email sent successfully!', data);
          sendResponse({ success: true, data: data });
        } else {
          console.error('Background: Failed to send email:', data);
          sendResponse({ success: false, error: data.message || 'Failed to send email' });
        }
      } catch (error) {
        console.error('Background: Error sending email:', error);
        sendResponse({ success: false, error: error.message });
      }
    })();
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  }
});