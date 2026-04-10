const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
const BASE_ID = 'appI5TaR5KnZM0Hst';
const TEMPLATES_TABLE = 'tblNQzAYRkPIJ85TM';
const INTERACTIONS_TABLE = 'tblnQ3sBBqd1UnO4t';

const F_SUBJECT      = 'fldobLsEfXNvwziFt';
const F_EMAIL_BODY   = 'fldlW7VPi0ft7zWXv';
const F_PEOPLE       = 'fldZezQOhy76qUG9I';
const F_DATE         = 'fldYUUSMlYF7DmgZm';
const F_TYPE         = 'fld5afjc2wU1eBnXN';
const F_NOTES        = 'fldFPj2OK8FktcakJ';
const F_SENDER_EMAIL = 'fldeCeoUqDntsgKUZ';

app.get('/templates', async (req, res) => {
  try {
    const params = new URLSearchParams({
      filterByFormula: 'isActive=1',
      'sort[0][field]': 'templateName',
      'sort[0][direction]': 'asc'
    });

    const response = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${TEMPLATES_TABLE}?${params}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } }
    );

    const data = await response.json();

    if (!data.records) {
      console.error('Templates error:', JSON.stringify(data));
      return res.status(500).json({ error: 'Failed to fetch templates' });
    }

    res.json(data.records.map(r => ({
      id: r.id,
      name: r.fields['templateName'] || '',
      subject: r.fields['subject'] || '',
      body: r.fields['body'] || ''
    })));

  } catch (err) {
    console.error('Templates fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

app.post('/log', async (req, res) => {
  console.log('Received:', JSON.stringify(req.body));

  const contactId   = String(req.body.contactId   || '').trim();
  const subject     = String(req.body.subject     || '').trim();
  const body        = String(req.body.body        || '').trim();
  const notes       = String(req.body.notes       || '').trim();
  const senderEmail = String(req.body.senderEmail || '').trim();

  if (!contactId.startsWith('rec')) {
    return res.status(400).json({ error: 'Invalid contactId: ' + contactId });
  }
  if (!subject) {
    return res.status(400).json({ error: 'Subject is required' });
  }

  const fields = {
    [F_SUBJECT]: subject,
    [F_PEOPLE]:  [{ id: contactId }],
    [F_DATE]:    new Date().toISOString(),
    [F_TYPE]:    'Email - General'
  };

  if (body)        fields[F_EMAIL_BODY]   = body;
  if (notes)       fields[F_NOTES]        = notes;
  if (senderEmail) fields[F_SENDER_EMAIL] = senderEmail;

  console.log('Writing:', JSON.stringify(fields));

  try {
    const response = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${INTERACTIONS_TABLE}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields, typecast: true })
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error('Airtable error:', JSON.stringify(data));
      return res.status(400).json({ error: data.error.message || JSON.stringify(data.error) });
    }

    console.log('Success:', data.id);
    res.json({ success: true, recordId: data.id });

  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Failed to log interaction' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Mission Control email server running on port ${PORT}`));
