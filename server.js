const express = require('express');
const fetch = require('node-fetch');
const path = require('path');
const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const AIRTABLE_API_KEY   = process.env.AIRTABLE_API_KEY;
const BASE_ID            = 'appI5TaR5KnZM0Hst';
const TEMPLATES_TABLE    = 'tblNQzAYRkPIJ85TM';
const INTERACTIONS_TABLE = 'tblnQ3sBBqd1UnO4t';
const USERS_TABLE        = 'tblxCSixNOmRkeLxe';

// ── Interactions field IDs ─────────────────────────────────────────────────
const F_SUBJECT      = 'fldobLsEfXNvwziFt';
const F_EMAIL_BODY   = 'fldlW7VPi0ft7zWXv';
const F_CONTACT      = 'fldZezQOhy76qUG9I';
const F_DATE         = 'fldYUUSMlYF7DmgZm';
const F_TYPE         = 'fld5afjc2wU1eBnXN';
const F_NOTES        = 'fldFPj2OK8FktcakJ';
const F_CREATED_BY   = 'fld5usEdNQrV9bnw6';
const F_EMAIL_STATUS = 'fldCDdGuAs3TKVr66';
const F_VISIBILITY   = 'fldvLutxnMllVemyG';

// ── Look up Airtable Users record ID by email ──────────────────────────────
async function getUserRecordId(email) {
  if (!email) return null;
  try {
    const params = new URLSearchParams({
      filterByFormula: `{emailAddress}="${email}"`,
      maxRecords: 1,
      fields: ['emailAddress']
    });
    const response = await fetch(
      `https://api.airtable.com/v0/${BASE_ID}/${USERS_TABLE}?${params}`,
      { headers: { Authorization: `Bearer ${AIRTABLE_API_KEY}` } }
    );
    const data = await response.json();
    if (data.records && data.records.length > 0) {
      console.log(`Resolved user email ${email} → ${data.records[0].id}`);
      return data.records[0].id;
    }
    console.log(`No Users record found for email: ${email}`);
    return null;
  } catch (err) {
    console.error('User lookup error:', err);
    return null;
  }
}

// ── GET /templates ─────────────────────────────────────────────────────────
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
      id:      r.id,
      name:    r.fields['templateName'] || '',
      subject: r.fields['subject']      || '',
      body:    r.fields['emailBody']    || '',
      type:    r.fields['type']         || 'Email - General'
    })));

  } catch (err) {
    console.error('Templates fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// ── POST /log ──────────────────────────────────────────────────────────────
app.post('/log', async (req, res) => {
  console.log('POST /log:', JSON.stringify(req.body));

  const contactId       = String(req.body.contactId       || '').trim();
  const subject         = String(req.body.subject         || '').trim();
  const body            = String(req.body.body            || '').trim();
  const notes           = String(req.body.notes           || '').trim();
  const interactionType = String(req.body.interactionType || 'Email - General').trim();
  const senderEmail     = String(req.body.senderEmail     || '').trim();

  if (!contactId.startsWith('rec')) {
    return res.status(400).json({ error: 'Invalid contactId: ' + contactId });
  }
  if (!subject) {
    return res.status(400).json({ error: 'Subject is required' });
  }

  // Look up the Airtable Users record ID from the sender's email
  const airtableUserId = await getUserRecordId(senderEmail);

  const fields = {
    [F_SUBJECT]:      subject,
    [F_CONTACT]:      [contactId],
    [F_DATE]:         new Date().toISOString(),
    [F_TYPE]:         interactionType,
    [F_EMAIL_STATUS]: 'Sent',
    [F_VISIBILITY]:   'Everyone'
  };

  if (body)            fields[F_EMAIL_BODY] = body;
  if (notes)           fields[F_NOTES]      = notes;
  if (airtableUserId)  fields[F_CREATED_BY] = [airtableUserId];

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
        body: JSON.stringify({ fields })
      }
    );

    const data = await response.json();

    if (data.error) {
      // If createdBy caused the error, retry without it
      if (data.error.type === 'INVALID_RECORD_ID' && fields[F_CREATED_BY]) {
        console.log('createdBy failed, retrying without it...');
        delete fields[F_CREATED_BY];
        const retry = await fetch(
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
        const retryData = await retry.json();
        if (retryData.error) {
          console.error('Retry failed:', JSON.stringify(retryData));
          return res.status(400).json({ error: retryData.error.message || JSON.stringify(retryData.error) });
        }
        console.log('Logged (without createdBy):', retryData.id);
        return res.json({ success: true, recordId: retryData.id, createdByLinked: false });
      }
      console.error('Airtable error:', JSON.stringify(data));
      return res.status(400).json({ error: data.error.message || JSON.stringify(data.error) });
    }

    console.log('Logged:', data.id, '| createdBy:', airtableUserId || 'not linked');
    res.json({ success: true, recordId: data.id, createdByLinked: !!airtableUserId });

  } catch (err) {
    console.error('Unexpected error:', err);
    res.status(500).json({ error: 'Failed to log interaction' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Mission Control email server running on port ${PORT}`));
