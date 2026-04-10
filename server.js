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

// Field IDs — EmailTemplates
const F_TEMPLATE_NAME    = 'fldgwYA3oBD02vAdv';
const F_TEMPLATE_SUBJECT = 'fldjEbn5yaCjPpwFV';
const F_TEMPLATE_BODY    = 'fldatN1jGBwgHgiw5';
const F_TEMPLATE_ACTIVE  = 'fldGvE2da67jYMI54';

// Field IDs — Interactions
const F_SUBJECT          = 'fldobLsEfXNvwziFt';
const F_EMAIL_BODY       = 'fldlW7VPi0ft7zWXv';
const F_PEOPLE           = 'fldZezQOhy76qUG9I';
const F_DATE             = 'fldYUUSMlYF7DmgZm';
const F_TYPE             = 'fld5afjc2wU1eBnXN';
const F_NOTES            = 'fldFPj2OK8FktcakJ';
const F_SENDER_EMAIL     = 'fldeCeoUqDntsgKUZ';
const F_EMAIL_TEMPLATE   = 'fldaEj2JAssfoMtHU';

// GET /templates — fetch all active templates
app.get('/templates', async (req, res) => {
  try {
    const url = `https://api.airtable.com/v0/${BASE_ID}/${TEMPLATES_TABLE}` +
      `?filterByFormula={${F_TEMPLATE_ACTIVE}}=1` +
      `&fields[]=${F_TEMPLATE_NAME}&fields[]=${F_TEMPLATE_SUBJECT}&fields[]=${F_TEMPLATE_BODY}` +
      `&sort[0][field]=${F_TEMPLATE_NAME}&sort[0][direction]=asc`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` }
    });
    const data = await response.json();

    const templates = (data.records || []).map(r => ({
      id: r.id,
      name: r.fields[F_TEMPLATE_NAME] || '',
      subject: r.fields[F_TEMPLATE_SUBJECT] || '',
      body: r.fields[F_TEMPLATE_BODY] || ''
    }));

    res.json(templates);
  } catch (err) {
    console.error('Error fetching templates:', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// POST /log — create an Interactions record
app.post('/log', async (req, res) => {
  const { contactId, subject, body, notes, senderEmail, templateId } = req.body;

  if (!contactId || !subject) {
    return res.status(400).json({ error: 'contactId and subject are required' });
  }

  try {
    const fields = {
      [F_SUBJECT]: subject,
      [F_EMAIL_BODY]: body || '',
      [F_PEOPLE]: [{ id: contactId }],
      [F_DATE]: new Date().toISOString(),
      [F_TYPE]: 'Email - General',
    };

    if (notes)        fields[F_NOTES] = notes;
    if (senderEmail)  fields[F_SENDER_EMAIL] = senderEmail;
    if (templateId)   fields[F_EMAIL_TEMPLATE] = [{ id: templateId }];

    const response = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${INTERACTIONS_TABLE}`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ fields })
      }
    );

    const data = await response.json();
    if (data.error) return res.status(400).json({ error: data.error });
    res.json({ success: true, recordId: data.id });
  } catch (err) {
    console.error('Error logging interaction:', err);
    res.status(500).json({ error: 'Failed to log interaction' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Mission Control email server running on port ${PORT}`));
