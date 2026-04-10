# Mission Control — Email Drawer

A lightweight Express server that powers the email draft drawer in Mission Control (Noloco). It serves the drawer UI, proxies Airtable API calls to keep your API key server-side, and logs sent emails as Interaction records.

---

## Setup

### 1. Install dependencies
```
npm install
```

### 2. Set your environment variable
In Railway, add this environment variable in your project settings:
```
AIRTABLE_API_KEY=your_airtable_api_key_here
```

### 3. Run locally for testing
```
npm start
```
Then open: http://localhost:3000?contactId=recXXX&firstName=James&lastName=Whitfield&company=Marcus%20%26%20Millichap&email=j.whitfield@mandm.com&senderName=Brian&senderEmail=brian@yourcompany.com

---

## Deploy to Railway

1. Push this repo to GitHub
2. In Railway, create a new project → Deploy from GitHub repo
3. Add the AIRTABLE_API_KEY environment variable
4. Railway auto-deploys on every push — your URL will be: https://your-app.railway.app

---

## Noloco Integration

Add an Embed component to any record page in Noloco. Set the URL to:

```
https://your-app.railway.app?contactId={{record.id}}&firstName={{record.firstName}}&lastName={{record.lastName}}&company={{record.companyNameFull}}&email={{record.email}}&senderName={{loggedInUser.fullName}}&senderEmail={{loggedInUser.emailAddress}}
```

Adjust field names to match your exact Noloco field references.

---

## How It Works

- `GET /templates` — fetches all active EmailTemplates from Airtable
- `POST /log` — creates a new Interactions record linked to the contact
- `public/index.html` — the drawer UI (served as a static file)
